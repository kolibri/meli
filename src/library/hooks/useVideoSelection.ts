import {useState} from 'react'

import type {Video} from '../types'

export function useVideoSelection(videoData: Video[], visibleVideos: Video[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const selectedVideos = videoData.filter((video) => selectedIds.has(video.id))

    function handleToggleSelection(id: string, checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current)

            if (checked) {
                next.add(id)
            } else {
                next.delete(id)
            }

            return next
        })
    }

    function handleSetSelection(ids: string[]) {
        setSelectedIds(new Set(ids))
    }

    function handleSelectVisible() {
        setSelectedIds((current) => {
            const next = new Set(current)

            for (const video of visibleVideos) {
                next.add(video.id)
            }

            return next
        })
    }

    function handleClearSelection() {
        setSelectedIds(new Set())
    }

    return {
        selectedIds,
        setSelectedIds,
        selectedVideos,
        handleToggleSelection,
        handleSetSelection,
        handleSelectVisible,
        handleClearSelection,
    }
}
