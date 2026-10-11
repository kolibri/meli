import type {Dispatch, SetStateAction} from 'react'
import {useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import type {Video} from '../types'

type RequestedFrames = {
    current: Set<string>
}

export function useVideoDeletion(
    videoData: Video[],
    selectedIds: Set<string>,
    setVideoData: Dispatch<SetStateAction<Video[]>>,
    setSelectedIds: Dispatch<SetStateAction<Set<string>>>,
    requestedFrames: RequestedFrames,
) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<Video[]>([])

    function handleDeleteSelected() {
        if (isDeleting) return

        const selected = videoData.filter((video) =>
            selectedIds.has(video.id),
        )

        if (selected.length === 0) return

        setDeleteError('')
        setPendingDelete(selected)
        setShowDeleteConfirmation(true)
    }

    function handleCancelDelete() {
        if (isDeleting) return

        setShowDeleteConfirmation(false)
        setPendingDelete([])
    }

    async function confirmDeleteSelected() {
        if (pendingDelete.length === 0 || isDeleting) return

        const pathsToDelete = pendingDelete.map((video) => video.path)

        setIsDeleting(true)
        setDeleteError('')
        setShowDeleteConfirmation(false)

        try {
            const result = await invoke<{
                deletedPaths: string[]
                errors: string[]
            }>('delete_video_files', {
                paths: pathsToDelete,
            })

            const deletedPaths = new Set(result.deletedPaths)

            if (deletedPaths.size > 0) {
                setVideoData((current) =>
                    current.filter((video) => !deletedPaths.has(video.path)),
                )

                setSelectedIds((current) => {
                    const deletedIds = new Set(
                        pendingDelete
                            .filter((video) => deletedPaths.has(video.path))
                            .map((video) => video.id),
                    )

                    return new Set(
                        [...current].filter((id) => !deletedIds.has(id)),
                    )
                })

                for (const path of deletedPaths) {
                    requestedFrames.current.delete(path)
                }
            }

            if (result.errors.length > 0) {
                setDeleteError(result.errors.join('\n'))
            }
        } catch (error) {
            setDeleteError(String(error))
        } finally {
            setIsDeleting(false)
            setPendingDelete([])
        }
    }

    return {
        isDeleting,
        deleteError,
        showDeleteConfirmation,
        pendingDelete,
        handleDeleteSelected,
        handleCancelDelete,
        confirmDeleteSelected,
    }
}
