
import './Library.css'

import { useRef } from 'react'

import { useStorage } from './library/hooks/useStorage'
import { useLibrary } from './library/hooks/useLibrary'
import { LibraryToolbar } from './library/components/LibraryToolbar'
import { VideoTable } from './library/components/VideoTable'

export function Library() {
    const requestedFrames = useRef<Set<string>>(new Set())

    const {
        storageDir,
        storageLoading,
        storageError,
        setStorageError,
        handleChooseStorage,
    } = useStorage()

    const {
        setVideoData,
        isImporting,
        importError,
        handleAddFolder,
        search,
        setSearch,
        filteredVideos,
    } = useLibrary(storageDir, setStorageError, requestedFrames)

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
            />

            <VideoTable
                videos={filteredVideos}
                setVideoData={setVideoData}
                storageDir={storageDir}
                requestedFrames={requestedFrames}
            />
        </main>
    )
}

export default Library
