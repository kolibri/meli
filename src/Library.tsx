
import './Library.css'

import {useRef, useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import type {Video} from './library/types'
import {useStorage} from './library/hooks/useStorage'
import {useLibrary} from './library/hooks/useLibrary'
import {usePlaylists} from './library/hooks/usePlaylists'
import {useVideoSelection} from './library/hooks/useVideoSelection'
import {useVideoMetadata} from './library/hooks/useVideoMetadata'
import {useVideoDeletion} from './library/hooks/useVideoDeletion'
import {useVideoPlayback} from './library/hooks/useVideoPlayback'
import {LibraryToolbar} from './library/components/LibraryToolbar'
import {LibrarySidebar} from './library/components/LibrarySidebar'
import {VideoTable} from './library/components/VideoTable'
import {LibraryDeleteConfirmation} from './library/components/LibraryDeleteConfirmation'
import {LibraryActiveFilters} from './library/components/LibraryActiveFilters'
import {
    getAvailableTags,
    getVideosForView,
    getVisibleVideos,
    type RatingFilter,
} from './library/selectors'

export function Library() {
    const requestedFrames = useRef<Set<string>>(new Set())
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [tagMatchMode, setTagMatchMode] = useState<'AND' | 'OR'>('AND')
    const [untaggedOnly, setUntaggedOnly] = useState(false)
    const [ratingFilter, setRatingFilter] = useState<RatingFilter>(null)

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

    const {
        playlists,
        activePlaylistId,
        setActivePlaylistId,
        playlistVideos,
        playlistError,
        setPlaylistError,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addVideosToPlaylist,
        removeVideoFromPlaylist,
    } = usePlaylists(storageDir)

    const {availableTags, tagNames} = getAvailableTags(videoData)

    const videosForView = getVideosForView({
        activePlaylistId,
        filteredVideos,
        playlistVideos,
        videoData,
        search,
    })

    const visibleVideos = getVisibleVideos({
        videos: videosForView,
        selectedTags,
        tagMatchMode,
        untaggedOnly,
        ratingFilter,
    })

    const {
        selectedIds,
        setSelectedIds,
        selectedVideos,
        handleToggleSelection,
        handleSetSelection,
        handleSelectVisible,
        handleClearSelection,
    } = useVideoSelection(videoData, visibleVideos)

    const {playbackError, handlePlayVideos} = useVideoPlayback()

    const {
        metadataError,
        bulkTag,
        setBulkTag,
        isBulkTagging,
        handleRatingChange,
        handleTagsChange,
        handleBulkTag,
    } = useVideoMetadata(setVideoData, selectedVideos)

    const {
        isDeleting,
        deleteError,
        showDeleteConfirmation,
        pendingDelete,
        handleDeleteSelected,
        handleCancelDelete,
        confirmDeleteSelected,
    } = useVideoDeletion(
        videoData,
        selectedIds,
        setVideoData,
        setSelectedIds,
        requestedFrames,
    )

    async function handleRemoveSelectedFromPlaylist() {
        if (activePlaylistId === null) return

        const paths = playlistVideos
            .filter((video) => selectedIds.has(video.id))
            .map((video) => video.path)

        for (const path of paths) {
            await removeVideoFromPlaylist(activePlaylistId, path)
        }

        setSelectedIds((current) => {
            const next = new Set(current)
            for (const path of paths) next.delete(path)
            return next
        })
    }

    async function handlePlayPlaylist(playlistId: number) {
        try {
            const videos =
                activePlaylistId === playlistId && playlistVideos.length > 0
                    ? playlistVideos
                    : await invoke<Video[]>('load_playlist_videos', {
                          playlistId,
                      })

            if (videos.length > 0) {
                await handlePlayVideos(videos.map((video) => video.path))
            }
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    return (
        <main className="library">
            <LibraryToolbar
                videoCount={visibleVideos.length}
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
                metadataError={metadataError}
                onDeleteSelected={handleDeleteSelected}
                isDeleting={isDeleting}
            />

            <div className="library-content">
                <LibrarySidebar
                    filteredVideos={filteredVideos}
                    selectedTags={selectedTags}
                    setSelectedTags={setSelectedTags}
                    untaggedOnly={untaggedOnly}
                    setUntaggedOnly={setUntaggedOnly}
                    playlists={playlists}
                    activePlaylistId={activePlaylistId}
                    setActivePlaylistId={setActivePlaylistId}
                    selectedVideos={selectedVideos}
                    onPlayPlaylist={handlePlayPlaylist}
                    addVideosToPlaylist={addVideosToPlaylist}
                    renamePlaylist={renamePlaylist}
                    deletePlaylist={deletePlaylist}
                    playlistError={playlistError}
                    deleteError={deleteError}
                    videoData={videoData}
                    ratingFilter={ratingFilter}
                    setRatingFilter={setRatingFilter}
                    tagMatchMode={tagMatchMode}
                    setTagMatchMode={setTagMatchMode}
                    availableTags={availableTags}
                    selectedIds={selectedIds}
                    createPlaylist={createPlaylist}
                    bulkTag={bulkTag}
                    isBulkTagging={isBulkTagging}
                    onBulkTagChange={setBulkTag}
                    onBulkTag={() => void handleBulkTag()}
                />
                <section className="library-results" aria-label="Video results">
                    <LibraryActiveFilters
                        selectedTags={selectedTags}
                        tagMatchMode={tagMatchMode}
                        untaggedOnly={untaggedOnly}
                        ratingFilter={ratingFilter}
                        tagNames={tagNames}
                        onClear={() => {
                            setSelectedTags([])
                            setUntaggedOnly(false)
                            setRatingFilter(null)
                        }}
                    />

                    {activePlaylistId !== null && (
                        <div className="playlist-actions">
                            <strong>
                                {
                                    playlists.find(
                                        (playlist) =>
                                            playlist.id === activePlaylistId,
                                    )?.name
                                }
                            </strong>

                            <button
                                type="button"
                                disabled={playlistVideos.length === 0}
                                onClick={() =>
                                    void handlePlayVideos(
                                        playlistVideos.map((video) => video.path),
                                    )
                                }
                            >
                                Play playlist
                            </button>

                            <button
                                type="button"
                                disabled={
                                    !playlistVideos.some((video) =>
                                        selectedIds.has(video.id),
                                    )
                                }
                                onClick={() =>
                                    void handleRemoveSelectedFromPlaylist()
                                }
                            >
                                Remove selected from playlist
                            </button>
                        </div>
                    )}

                    <VideoTable
                        videos={visibleVideos}
                        setVideoData={setVideoData}
                        storageDir={storageDir}
                        requestedFrames={requestedFrames}
                        selectedIds={selectedIds}
                        onToggleSelection={handleToggleSelection}
                        onSetSelection={handleSetSelection}
                        onPlayVideo={(path) => handlePlayVideos([path])}
                        onRatingChange={handleRatingChange}
                        onTagsChange={handleTagsChange}
                    />
                </section>
            </div>

            {showDeleteConfirmation && (
                <LibraryDeleteConfirmation
                    pendingDelete={pendingDelete}
                    isDeleting={isDeleting}
                    onCancel={handleCancelDelete}
                    onConfirm={() => void confirmDeleteSelected()}
                />
            )}
        </main>
    )
}

export default Library