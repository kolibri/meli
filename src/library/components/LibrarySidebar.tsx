import type {Dispatch, SetStateAction} from 'react'

import type {Playlist, Video} from '../types.ts'
import type {AvailableTag, RatingFilter} from '../selectors.ts'
import {LibraryBulkTagBar} from './LibraryBulkTagBar'

type LibrarySidebarProps = {
    filteredVideos: Video[]
    selectedTags: string[]
    setSelectedTags: Dispatch<SetStateAction<string[]>>
    untaggedOnly: boolean
    setUntaggedOnly: Dispatch<SetStateAction<boolean>>
    playlists: Playlist[]
    activePlaylistId: number | null
    setActivePlaylistId: Dispatch<SetStateAction<number | null>>
    selectedVideos: Video[]
    addVideosToPlaylist: (playlistId: number, videoPaths: string[]) => Promise<void>
    renamePlaylist: (playlistId: number, name: string) => Promise<void>
    deletePlaylist: (playlistId: number) => Promise<void>
    playlistError: string
    deleteError: string
    videoData: Video[]
    ratingFilter: RatingFilter
    setRatingFilter: Dispatch<SetStateAction<RatingFilter>>
    tagMatchMode: 'AND' | 'OR'
    setTagMatchMode: Dispatch<SetStateAction<'AND' | 'OR'>>
    availableTags: AvailableTag[]
    selectedIds: Set<string>
    createPlaylist: (name: string) => Promise<void>
    bulkTag: string
    isBulkTagging: boolean
    onBulkTagChange: (value: string) => void
    onBulkTag: () => void
}

export function LibrarySidebar(
    {
        filteredVideos,
        selectedTags,
        setSelectedTags,
        untaggedOnly,
        setUntaggedOnly,
        playlists,
        activePlaylistId,
        setActivePlaylistId,
        selectedVideos,
        addVideosToPlaylist,
        renamePlaylist,
        deletePlaylist,
        playlistError,
        deleteError,
        videoData,
        ratingFilter,
        setRatingFilter,
        tagMatchMode,
        setTagMatchMode,
        availableTags,
        createPlaylist,
        bulkTag,
        isBulkTagging,
        onBulkTagChange,
        onBulkTag,
    }: LibrarySidebarProps) {
    return (
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

            <LibraryBulkTagBar
                selectedCount={selectedVideos.length}
                bulkTag={bulkTag}
                isBulkTagging={isBulkTagging}
                onBulkTagChange={onBulkTagChange}
                onBulkTag={onBulkTag}
            />

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
    )
}
