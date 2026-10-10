
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import type { Video } from '../types'

type RequestedFrames = {
    current: Set<string>
}

export function useLibrary(
    storageDir: string | null,
    setStorageError: Dispatch<SetStateAction<string>>,
    requestedFrames: RequestedFrames,
) {
    const [videoData, setVideoData] = useState<Video[]>([])
    const [isImporting, setIsImporting] = useState(false)
    const [importError, setImportError] = useState('')
    const [search, setSearch] = useState('')

    async function handleAddFolder() {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select video folder',
        })

        if (typeof selected !== 'string') return

        setIsImporting(true)
        setImportError('')

        try {
            const found = await invoke<Video[]>('scan_video_folder', {
                folderPath: selected,
            })

            for (const video of found) {
                requestedFrames.current.delete(video.id)
            }

            setVideoData((current) => {
                const byPath = new Map(
                    current.map((video) => [video.id, video]),
                )

                for (const video of found) {
                    byPath.set(video.id, video)
                }

                return Array.from(byPath.values())
            })
        } catch (error) {
            setImportError(String(error))
        } finally {
            setIsImporting(false)
        }
    }

    useEffect(() => {
        if (!storageDir) return

        let cancelled = false
        requestedFrames.current.clear()

        invoke<Video[]>('load_library')
            .then((videos) => {
                if (!cancelled) setVideoData(videos)
            })
            .catch((error) => {
                if (!cancelled) setStorageError(String(error))
            })

        return () => {
            cancelled = true
        }
    }, [storageDir, setStorageError, requestedFrames])

    const filteredVideos = useMemo(() => {
        const query = search.trim().toLowerCase()

        if (!query) return videoData

        return videoData.filter((video) => {
            const filename = video.filename ?? ''
            const tags = video.tags ?? []

            return (
                filename.toLowerCase().includes(query) ||
                tags.some((tag) => tag.toLowerCase().includes(query))
            )
        })
    }, [search, videoData])

    return {
        videoData,
        setVideoData,
        isImporting,
        importError,
        handleAddFolder,
        search,
        setSearch,
        filteredVideos,
    }
}
