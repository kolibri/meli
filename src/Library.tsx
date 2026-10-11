import './Library.css'

import {useRef, useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import {useStorage} from './library/hooks/useStorage'
import {useLibrary} from './library/hooks/useLibrary'
import {LibraryToolbar} from './library/components/LibraryToolbar'
import {LibrarySidebar} from './library/components/LibrarySidebar'
import {VideoTable} from './library/components/VideoTable'
import {usePlaylists} from './library/hooks/usePlaylists'
import {LibraryBulkTagBar} from './library/components/LibraryBulkTagBar'
import {LibraryDeleteConfirmation} from './library/components/LibraryDeleteConfirmation'
import {LibraryActiveFilters} from './library/components/LibraryActiveFilters'
import {
    getAvailableTags,
    getVideosForView,
    getVisibleVideos,
} from './library/selectors'

export function Library() {
    const requestedFrames = useRef<Set<string>>(new Set())
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [tagMatchMode, setTagMatchMode] = useState<'AND' | 'OR'>('AND')
    const [untaggedOnly, setUntaggedOnly] = useState(false)
    const [ratingFilter, setRatingFilter] = useState<number | 'unrated' | null>(null)
    const [playbackError, setPlaybackError] = useState('')
    const [metadataError, setMetadataError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
    const [bulkTag, setBulkTag] = useState('')
    const [isBulkTagging, setIsBulkTagging] = useState(false)

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

    const [pendingDelete, setPendingDelete] = useState<typeof videoData>([])

    const {
        playlists,
        activePlaylistId,
        setActivePlaylistId,
        playlistVideos,
        playlistError,
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

    async function handlePlayVideos(paths: string[]) {
        setPlaybackError('')

        try {
            await invoke<void>('open_videos_in_vlc', {paths})
        } catch (error) {
            setPlaybackError(String(error))
        }
    }

    async function handleRatingChange(
        path: string,
        rating: number,
    ): Promise<boolean> {
        setMetadataError('')

        try {
            await invoke<void>('update_video_rating', {
                videoPath: path,
                rating,
            })

            setVideoData((current) =>
                current.map((video) =>
                    video.path === path ? {...video, rating} : video,
                ),
            )

            return true
        } catch (error) {
            setMetadataError(String(error))
            return false
        }
    }

    async function handleTagsChange(
        path: string,
        tags: string[],
    ): Promise<boolean> {
        setMetadataError('')

        try {
            await invoke<void>('update_video_tags', {
                videoPath: path,
                tags,
            })

            setVideoData((current) =>
                current.map((video) =>
                    video.path === path ? {...video, tags} : video,
                ),
            )

            return true
        } catch (error) {
            setMetadataError(String(error))
            return false
        }
    }

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

    async function handleBulkTag() {
        const tagToAdd = bulkTag.trim()

        if (!tagToAdd || selectedVideos.length === 0 || isBulkTagging) {
            return
        }

        setIsBulkTagging(true)
        setMetadataError('')

        const updatedTags = new Map<string, string[]>()
        const failures: string[] = []

        try {
            for (const video of selectedVideos) {
                const existingTags = video.tags ?? []
                const alreadyHasTag = existingTags.some(
                    (tag) => tag.trim().toLocaleLowerCase() ===
                        tagToAdd.toLocaleLowerCase(),
                )

                if (alreadyHasTag) {
                    continue
                }

                const nextTags = [...existingTags, tagToAdd]

                try {
                    await invoke<void>('update_video_tags', {
                        videoPath: video.path,
                        tags: nextTags,
                    })
                    updatedTags.set(video.path, nextTags)
                } catch (error) {
                    failures.push(`${video.filename}: ${String(error)}`)
                }
            }

            if (updatedTags.size > 0) {
                setVideoData((current) =>
                    current.map((video) => {
                        const tags = updatedTags.get(video.path)
                        return tags ? {...video, tags} : video
                    }),
                )
            }

            if (failures.length > 0) {
                setMetadataError(
                    `Added "${tagToAdd}" to ${updatedTags.size} video(s). ` +
                    `${failures.length} update(s) failed:\n${failures.join('\n')}`,
                )
            } else {
                setMetadataError(
                    updatedTags.size > 0
                        ? `Added "${tagToAdd}" to ${updatedTags.size} video(s).`
                        : `All selected videos already have the tag "${tagToAdd}".`,
                )
                setBulkTag('')
            }
        } finally {
            setIsBulkTagging(false)
        }
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

                            <button
                                type="button"
                                onClick={() => setActivePlaylistId(null)}
                            >
                                Back to all videos
                            </button>
                        </div>
                    )}

                    <LibraryBulkTagBar
                        selectedCount={selectedVideos.length}
                        bulkTag={bulkTag}
                        isBulkTagging={isBulkTagging}
                        onBulkTagChange={setBulkTag}
                        onBulkTag={() => void handleBulkTag()}
                    />

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