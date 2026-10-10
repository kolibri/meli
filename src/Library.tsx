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
    const [ratingFilter, setRatingFilter] = useState<number | 'unrated' | null>(null)
    const [playbackError, setPlaybackError] = useState('')
    const [metadataError, setMetadataError] = useState('')

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

        return matchesTags && matchesRating
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
            />

            <div className="library-content">
                <aside className="library-sidebar" aria-label="Library filters">
                    <h2 className="library-sidebar-heading">Library</h2>

                    <button
                        type="button"
                        className={`library-filter-item${selectedTags.length === 0 ? ' active' : ''}`}
                        aria-pressed={selectedTags.length === 0}
                        onClick={() => setSelectedTags([])}
                    >
                        <span className="library-filter-label">
                            <span aria-hidden="true">▤</span>
                            All videos
                        </span>
                        <span className="library-filter-count">
                            {filteredVideos.length}
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
                                    <span aria-hidden="true">+</span>
                                </button>

                                <button
                                    type="button"
                                    className="playlist-icon-button"
                                    title={`Rename ${playlist.name}`}
                                    aria-label={`Rename ${playlist.name}`}
                                    onClick={() => {
                                        const name = window.prompt('Rename playlist', playlist.name)
                                        if (name) void renamePlaylist(playlist.id, name)
                                    }}
                                >
                                    <span aria-hidden="true">✎</span>
                                </button>

                                <button
                                    type="button"
                                    className="playlist-icon-button playlist-delete-button"
                                    title={`Delete ${playlist.name}`}
                                    aria-label={`Delete ${playlist.name}`}
                                    onClick={() => {
                                        if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
                                            void deletePlaylist(playlist.id)
                                        }
                                    }}
                                >
                                    <span aria-hidden="true">×</span>
                                </button>

                            </div>
                        ))}
                    </div>

                    {playlistError && (
                        <p className="library-import-error" role="alert">
                            Playlist error: {playlistError}
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
                {'★'.repeat(minimum)}{'☆'.repeat(5 - minimum)}
                <span> and up</span>
            </span>
                                <span className="library-filter-count">
                {videoData.filter(
                    (video) => (Number(video.rating) || 0) >= minimum,
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


                    <div className="tag-match-toggle" role="group" aria-label="Tag matching mode">
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
                        <p className="library-sidebar-empty">
                            No tags yet
                        </p>
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


                    {(selectedTags.length > 0 || ratingFilter !== null) && (
                        <div className="library-active-filter">
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
                                {playlists.find((playlist) => playlist.id === activePlaylistId)?.name}
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
                                    activePlaylistId === null ||
                                    !playlistVideos.some((video) => selectedIds.has(video.id))
                                }
                                onClick={() => void handleRemoveSelectedFromPlaylist()}
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
                    <VideoTable
                        videos={visibleVideos}
                        setVideoData={setVideoData}
                        storageDir={storageDir}
                        requestedFrames={requestedFrames}
                        selectedIds={selectedIds}
                        onToggleSelection={handleToggleSelection}
                        onPlayVideo={(path) => handlePlayVideos([path])}
                        onRatingChange={handleRatingChange}
                        onTagsChange={handleTagsChange}
                    />
                </section>
            </div>
        </main>
    )
}

export default Library
