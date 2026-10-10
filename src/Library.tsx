
import './Library.css'

import { useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

import { useStorage } from './library/hooks/useStorage'
import { useLibrary } from './library/hooks/useLibrary'
import { LibraryToolbar } from './library/components/LibraryToolbar'
import { VideoTable } from './library/components/VideoTable'

export function Library() {
    const requestedFrames = useRef<Set<string>>(new Set())
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [playbackError, setPlaybackError] = useState('')

    const {
        storageDir,
        storageLoading,
        storageError,
        setStorageError,
        handleChooseStorage,
    } = useStorage()

    const {
        videoData,
        setVideoData,
        isImporting,
        importError,
        handleAddFolder,
        search,
        setSearch,
        filteredVideos,
    } = useLibrary(storageDir, setStorageError, requestedFrames)

    const selectedVideos = videoData.filter(
        (video) => selectedIds.has(video.id),
    )

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

    function handleSelectVisible() {
        setSelectedIds((current) => {
            const next = new Set(current)

            for (const video of filteredVideos) {
                next.add(video.id)
            }

            return next
        })
    }

    function handleClearSelection() {
        setSelectedIds(new Set())
    }

    async function handlePlayVideos(paths: string[]) {
        setPlaybackError('')

        try {
            await invoke<void>('open_videos_in_vlc', { paths })
        } catch (error) {
            setPlaybackError(String(error))
        }
    }

    return (
        <main className="library">
            <LibraryToolbar
                videoCount={filteredVideos.length}
                storageDir={storageDir}
                storageLoading={storageLoading}
                storageError={storageError}
                onChooseStorage={handleChooseStorage}
                isImporting={isImporting}
                importError={importError}
                onAddFolder={handleAddFolder}
                search={search}
                onSearchChange={setSearch}
                selectedCount={selectedVideos.length}
                onPlaySelected={() =>
                    handlePlayVideos(
                        selectedVideos.map((video) => video.path),
                    )
                }
                onSelectVisible={handleSelectVisible}
                onClearSelection={handleClearSelection}
                playbackError={playbackError}
            />

            <VideoTable
                videos={filteredVideos}
                setVideoData={setVideoData}
                storageDir={storageDir}
                requestedFrames={requestedFrames}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onPlayVideo={(path) => handlePlayVideos([path])}
            />
        </main>
    )
}

export default Library
