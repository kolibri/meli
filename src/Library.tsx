import './Library.css'

import {useRef, useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import {useStorage} from './library/hooks/useStorage'
import {useLibrary} from './library/hooks/useLibrary'
import {LibraryToolbar} from './library/components/LibraryToolbar'
import {VideoTable} from './library/components/VideoTable'
import {usePlaylists} from './library/hooks/usePlaylists'

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

    const tagCounts = new Map<string, number>()
    const tagNames = new Map<string, string>()

    for (const video of videoData) {
        const tagsOnVideo = new Set<string>()

        for (const rawTag of video.tags ?? []) {
            const tag = rawTag.trim()
            if (!tag) continue

            const key = tag.toLocaleLowerCase()

            if (!tagsOnVideo.has(key)) {
                tagsOnVideo.add(key)
                tagNames.set(key, tagNames.get(key) ?? tag)
                tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1)
            }
        }
    }

    const availableTags = [...tagNames.entries()]
        .map(([key, name]) => ({
            key,
            name,
            count: tagCounts.get(key) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

    const videosForView =
        activePlaylistId === null
            ? filteredVideos
            : playlistVideos.filter((video) => {
                const query = search.trim().toLocaleLowerCase()
                return (
                    !query ||
                    video.filename.toLocaleLowerCase().includes(query) ||
                    video.tags.some((tag) =>
                        tag.toLocaleLowerCase().includes(query),
                    )
                )
            })

    const visibleVideos = videosForView.filter((video) => {
        const videoTags = (video.tags ?? []).map((tag) =>
            tag.trim().toLocaleLowerCase(),
        )

        const matchesUntagged =
            !untaggedOnly || !videoTags.some((tag) => tag.length > 0)

        const matchesTags =
            selectedTags.length === 0 ||
            (tagMatchMode === 'AND'
                ? selectedTags.every((tag) => videoTags.includes(tag))
                : selectedTags.some((tag) => videoTags.includes(tag)))

        const rating = Number(video.rating) || 0

        const matchesRating =
            ratingFilter === null ||
            (ratingFilter === 'unrated'
                ? rating === 0
                : rating >= ratingFilter)

        return matchesUntagged && matchesTags && matchesRating
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
                <aside className="library-sidebar" aria-label="Library filters">
                    <h2 className="library-sidebar-heading">Library</h2>

                    <button
                        type="button"
                        className={`library-filter-item${selectedTags.length === 0 ? ' active' : ''}`}
                        aria-pressed={selectedTags.length === 0}
                        onClick={() => {
                            setSelectedTags([])
                            setUntaggedOnly(false)
                        }}
                    >
                        <span className="library-filter-label">
                            <span aria-hidden="true">▤</span>
                            All videos
                        </span>
                        <span className="library-filter-count">
                            {filteredVideos.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        className={`library-filter-item${untaggedOnly ? ' active' : ''}`}
                        aria-pressed={untaggedOnly}
                        onClick={() => {
                            setUntaggedOnly((current) => !current)
                            setSelectedTags([])
                        }}
                    >
                        <span className="library-filter-label">
                            <span aria-hidden="true">#</span>
                            Untagged
                        </span>
                        <span className="library-filter-count">
                            {filteredVideos.filter(
                                (video) =>
                                    !(video.tags ?? []).some(
                                        (tag) => tag.trim().length > 0,
                                    ),
                            ).length}
                        </span>
                    </button>

                    <h3 className="library-sidebar-heading library-tags-heading">
                        Playlists
                    </h3>

                    <button
                        type="button"
                        className="library-filter-item"
                        onClick={() => {
                            const name = window.prompt('Playlist name')
                            if (name) void createPlaylist(name)
                        }}
                    >
                        <span className="library-filter-label">New playlist</span>
                    </button>

                    <div className="library-tag-list">
                        {playlists.map((playlist) => (
                            <div className="playlist-sidebar-item" key={playlist.id}>
                                <button
                                    type="button"
                                    className={`library-filter-item${
                                        activePlaylistId === playlist.id ? ' active' : ''
                                    }`}
                                    aria-pressed={activePlaylistId === playlist.id}
                                    onClick={() => setActivePlaylistId(playlist.id)}
                                >
                                    <span className="library-filter-label">
                                        {playlist.name}
                                    </span>
                                    <span className="library-filter-count">
                                        {playlist.videoCount}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="playlist-icon-button"
                                    title={`Add selected videos to ${playlist.name}`}
                                    aria-label={`Add selected videos to ${playlist.name}`}
                                    disabled={selectedVideos.length === 0}
                                    onClick={() =>
                                        void addVideosToPlaylist(
                                            playlist.id,
                                            selectedVideos.map((video) => video.path),
                                        )
                                    }
                                >
                                    <span className="nf-icon" aria-hidden="true">
                                        {'\uf067'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="playlist-icon-button"
                                    title={`Rename ${playlist.name}`}
                                    aria-label={`Rename ${playlist.name}`}
                                    onClick={() => {
                                        const name = window.prompt(
                                            'Rename playlist',
                                            playlist.name,
                                        )
                                        if (name) void renamePlaylist(playlist.id, name)
                                    }}
                                >
                                    <span className="nf-icon" aria-hidden="true">
                                        {'\uf040'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="playlist-icon-button playlist-delete-button"
                                    title={`Delete ${playlist.name}`}
                                    aria-label={`Delete ${playlist.name}`}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Delete playlist "${playlist.name}"?`,
                                            )
                                        ) {
                                            void deletePlaylist(playlist.id)
                                        }
                                    }}
                                >
                                    <span className="nf-icon" aria-hidden="true">
                                        {'\uf1f8'}
                                    </span>
                                </button>
                            </div>
                        ))}
                    </div>

                    {playlistError && (
                        <p className="library-import-error" role="alert">
                            Playlist error: {playlistError}
                        </p>
                    )}

                    {deleteError && (
                        <p className="library-import-error" role="alert">
                            Delete operation: {deleteError}
                        </p>
                    )}

                    <h3 className="library-sidebar-heading library-tags-heading">
                        Rating
                    </h3>

                    <div className="library-tag-list">
                        <button
                            type="button"
                            className={`library-filter-item${ratingFilter === null ? ' active' : ''}`}
                            aria-pressed={ratingFilter === null}
                            onClick={() => setRatingFilter(null)}
                        >
                            <span className="library-filter-label">All ratings</span>
                            <span className="library-filter-count">
                                {videoData.length}
                            </span>
                        </button>

                        {[5, 4, 3, 2, 1].map((minimum) => (
                            <button
                                key={minimum}
                                type="button"
                                className={`library-filter-item${ratingFilter === minimum ? ' active' : ''}`}
                                aria-pressed={ratingFilter === minimum}
                                onClick={() => setRatingFilter(minimum)}
                            >
                                <span className="library-filter-label">
                                    {'★'.repeat(minimum)}
                                    {'☆'.repeat(5 - minimum)}
                                    <span> and up</span>
                                </span>
                                <span className="library-filter-count">
                                    {videoData.filter(
                                        (video) =>
                                            (Number(video.rating) || 0) >= minimum,
                                    ).length}
                                </span>
                            </button>
                        ))}

                        <button
                            type="button"
                            className={`library-filter-item${ratingFilter === 'unrated' ? ' active' : ''}`}
                            aria-pressed={ratingFilter === 'unrated'}
                            onClick={() => setRatingFilter('unrated')}
                        >
                            <span className="library-filter-label">Not rated</span>
                            <span className="library-filter-count">
                                {videoData.filter(
                                    (video) => (Number(video.rating) || 0) === 0,
                                ).length}
                            </span>
                        </button>
                    </div>

                    <h3 className="library-sidebar-heading library-tags-heading">
                        Tags
                    </h3>

                    <div
                        className="tag-match-toggle"
                        role="group"
                        aria-label="Tag matching mode"
                    >
                        <button
                            type="button"
                            className={tagMatchMode === 'AND' ? 'active' : ''}
                            aria-pressed={tagMatchMode === 'AND'}
                            onClick={() => setTagMatchMode('AND')}
                        >
                            AND
                        </button>
                        <button
                            type="button"
                            className={tagMatchMode === 'OR' ? 'active' : ''}
                            aria-pressed={tagMatchMode === 'OR'}
                            onClick={() => setTagMatchMode('OR')}
                        >
                            OR
                        </button>
                    </div>

                    {availableTags.length === 0 ? (
                        <p className="library-sidebar-empty">No tags yet</p>
                    ) : (
                        <div className="library-tag-list">
                            {availableTags.map((tag) => (
                                <button
                                    key={tag.key}
                                    type="button"
                                    title={tag.name}
                                    className={`library-filter-item${selectedTags.includes(tag.key) ? ' active' : ''}`}
                                    aria-pressed={selectedTags.includes(tag.key)}
                                    onClick={() =>
                                        setSelectedTags((current) =>
                                            current.includes(tag.key)
                                                ? current.filter((key) => key !== tag.key)
                                                : [...current, tag.key],
                                        )
                                    }
                                >
                                    <span className="library-filter-label">
                                        <span aria-hidden="true">#</span>
                                        <span className="library-filter-name">
                                            {tag.name}
                                        </span>
                                    </span>
                                    <span className="library-filter-count">
                                        {tag.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="library-results" aria-label="Video results">
                    {(selectedTags.length > 0 || untaggedOnly || ratingFilter !== null) && (
                        <div className="library-active-filter">
                            {untaggedOnly && (
                                <span>
                                    Tags: <strong>Untagged</strong>
                                </span>
                            )}

                            {selectedTags.length > 0 && (
                                <span>
                                    Tags ({tagMatchMode}):{' '}
                                    <strong>
                                        {selectedTags
                                            .map((key) => tagNames.get(key) ?? key)
                                            .join(', ')}
                                    </strong>
                                </span>
                            )}

                            {ratingFilter !== null && (
                                <span>
                                    Rating:{' '}
                                    <strong>
                                        {ratingFilter === 'unrated'
                                            ? 'Not rated'
                                            : `${ratingFilter}+ stars`}
                                    </strong>
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedTags([])
                                    setUntaggedOnly(false)
                                    setRatingFilter(null)
                                }}
                                title="Clear all filters"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}

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

                    <div className="bulk-tag-bar">
                        <label htmlFor="bulk-tag-input">
                            Add tag to {selectedVideos.length} selected video(s)
                        </label>

                        <input
                            id="bulk-tag-input"
                            type="text"
                            value={bulkTag}
                            onChange={(event) => setBulkTag(event.target.value)}
                            placeholder="Enter tag to add"
                            disabled={isBulkTagging || selectedVideos.length === 0}
                        />

                        <button
                            type="button"
                            onClick={() => void handleBulkTag()}
                            disabled={
                                isBulkTagging ||
                                selectedVideos.length === 0 ||
                                !bulkTag.trim()
                            }
                        >
                            {isBulkTagging ? 'Adding tag…' : 'Add tag to selected'}
                        </button>
                    </div>

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
                <div className="delete-confirmation-backdrop">
                    <section
                        className="delete-confirmation-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="delete-confirmation-title"
                        aria-describedby="delete-confirmation-description"
                    >
                        <h2 id="delete-confirmation-title">
                            Permanently delete files?
                        </h2>

                        <p id="delete-confirmation-description">
                            You are about to permanently delete{' '}
                            <strong>{pendingDelete.length}</strong>{' '}
                            {pendingDelete.length === 1 ? 'file' : 'files'} from
                            your filesystem. This cannot be undone.
                        </p>

                        <ul className="delete-confirmation-file-list">
                            {pendingDelete.slice(0, 8).map((video) => (
                                <li key={video.path}>{video.filename}</li>
                            ))}
                        </ul>

                        {pendingDelete.length > 8 && (
                            <p>
                                And {pendingDelete.length - 8} more{' '}
                                {pendingDelete.length - 8 === 1 ? 'file' : 'files'}.
                            </p>
                        )}

                        <div className="delete-confirmation-actions">
                            <button
                                type="button"
                                onClick={handleCancelDelete}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="delete-confirmation-danger"
                                onClick={() => void confirmDeleteSelected()}
                                disabled={isDeleting || pendingDelete.length === 0}
                            >
                                {isDeleting
                                    ? 'Deleting…'
                                    : 'Permanently delete'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}

export default Library