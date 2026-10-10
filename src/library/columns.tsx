import { useState } from 'react'

import {
    columnSizingFeature,
    createSortedRowModel,
    rowSortingFeature,
    tableFeatures,
    type ColumnDef,
} from '@tanstack/react-table'

import type { Video } from './types'
import { formatDuration, formatSize } from './formatters'

export const features = tableFeatures({
    columnSizingFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
})

type MetadataCallbacks = {
    onRatingChange: (path: string, rating: number) => Promise<boolean>
    onTagsChange: (path: string, tags: string[]) => Promise<boolean>
}

function RatingEditor({
                          video,
                          onRatingChange,
                      }: {
    video: Video
    onRatingChange: MetadataCallbacks['onRatingChange']
}) {
    const rating = Math.max(0, Math.min(5, Number(video.rating) || 0))

    return (
        <div className="rating" aria-label={`Rating ${rating} out of 5`}>
            {Array.from({ length: 5 }, (_, index) => {
                const star = index + 1
                const active = star <= rating

                return (
                    <button
                        key={star}
                        type="button"
                        className={`rating-star${active ? ' active' : ''}`}
                        aria-label={
                            rating === star
                                ? `Clear rating of ${star}`
                                : `Set rating to ${star}`
                        }
                        aria-pressed={rating === star}
                        onClick={() =>
                            void onRatingChange(
                                video.path,
                                rating === star ? 0 : star,
                            )
                        }
                    >
                        {active ? '★' : '☆'}
                    </button>
                )
            })}
        </div>
    )
}

function TagsEditor({
                        video,
                        onTagsChange,
                    }: {
    video: Video
    onTagsChange: MetadataCallbacks['onTagsChange']
}) {
    const [newTag, setNewTag] = useState('')
    const [saving, setSaving] = useState(false)

    async function addTag() {
        const tag = newTag.trim()

        if (
            !tag ||
            saving ||
            video.tags.some(
                (existing) => existing.toLowerCase() === tag.toLowerCase(),
            )
        ) {
            return
        }

        setSaving(true)

        try {
            if (await onTagsChange(video.path, [...video.tags, tag])) {
                setNewTag('')
            }
        } finally {
            setSaving(false)
        }
    }

    async function removeTag(tagToRemove: string) {
        if (saving) return

        setSaving(true)

        try {
            await onTagsChange(
                video.path,
                video.tags.filter((tag) => tag !== tagToRemove),
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="tags-editor">
            <div className="tags-cell">
                {video.tags.length > 0 ? (
                    video.tags.map((tag, index) => (
                        <span className="tag" key={`${tag}-${index}`}>
                            {tag}
                            <button
                                type="button"
                                className="tag-remove"
                                aria-label={`Remove tag ${tag}`}
                                title={`Remove ${tag}`}
                                disabled={saving}
                                onClick={() => void removeTag(tag)}
                            >
                                ×
                            </button>
                        </span>
                    ))
                ) : (
                    <span className="muted">No tags</span>
                )}
            </div>

            <form
                className="tag-add-form"
                onSubmit={(event) => {
                    event.preventDefault()
                    void addTag()
                }}
            >
                <input
                    className="tag-input"
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    placeholder="Add tag…"
                    aria-label={`Add tag to ${video.filename}`}
                    disabled={saving}
                />
                <button
                    type="submit"
                    className="tag-add-button"
                    disabled={saving || !newTag.trim()}
                >
                    +
                </button>
            </form>
        </div>
    )
}

export function createColumns(
    selectedIds: Set<string>,
    onToggleSelection: (id: string, checked: boolean) => void,
    onPlayVideo: (path: string) => void,
    { onRatingChange, onTagsChange }: MetadataCallbacks,
): ColumnDef<typeof features, Video>[] {
    return [
        {
            id: 'selection',
            header: 'Select',
            size: 65,
            enableSorting: false,
            cell: (info) => {
                const video = info.row.original

                return (
                    <input
                        type="checkbox"
                        aria-label={`Select ${video.filename}`}
                        checked={selectedIds.has(video.id)}
                        onChange={(event) =>
                            onToggleSelection(video.id, event.target.checked)
                        }
                    />
                )
            },
        },
        {
            accessorKey: 'filename',
            header: 'Filename',
            size: 260,
            cell: (info) => (
                <span
                    className="filename-cell"
                    title={info.getValue<string>()}
                >
                    {info.getValue<string>()}
                </span>
            ),
        },
        {
            id: 'filmstrip',
            header: 'Preview',
            size: 390,
            enableSorting: false,
            cell: (info) => {
                const frames = info.row.original.frames ?? []

                return (
                    <div className="filmstrip">
                        {Array.from({ length: 10 }, (_, index) => {
                            const frame = frames[index]

                            return (
                                <div className="filmstrip-frame" key={index}>
                                    {frame ? (
                                        <img
                                            src={frame}
                                            alt={`Frame ${index + 1}`}
                                            loading="lazy"
                                            draggable={false}
                                        />
                                    ) : (
                                        <div className="frame-placeholder">
                                            {index + 1}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            },
        },
        {
            accessorKey: 'size',
            header: 'Size',
            size: 100,
            cell: (info) => formatSize(Number(info.getValue())),
        },
        {
            accessorKey: 'duration',
            header: 'Duration',
            size: 105,
            cell: (info) => formatDuration(Number(info.getValue())),
        },
        {
            accessorKey: 'tags',
            header: 'Tags',
            size: 200,
            enableSorting: false,
            cell: (info) => (
                <TagsEditor
                    video={info.row.original}
                    onTagsChange={onTagsChange}
                />
            ),
        },
        {
            accessorKey: 'rating',
            header: 'Rating',
            size: 130,
            enableSorting: false,
            cell: (info) => (
                <RatingEditor
                    video={info.row.original}
                    onRatingChange={onRatingChange}
                />
            ),
        },
        {
            id: 'play',
            header: 'Playback',
            size: 100,
            enableSorting: false,
            cell: (info) => (
                <button
                    type="button"
                    onClick={() => onPlayVideo(info.row.original.path)}
                >
                    Play
                </button>
            ),
        },
    ]
}