import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'

import {
    type ColumnDef,
    columnSizingFeature,
    createSortedRowModel,
    rowSortingFeature,
    tableFeatures,
} from '@tanstack/react-table'

import type {Video} from './types'
import {RatingEditor} from './components/RatingEditor'
import {formatDuration, formatSize} from './formatters'

export const features = tableFeatures({
    columnSizingFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
})

type MetadataCallbacks = {
    onRatingChange: (path: string, rating: number) => Promise<boolean>
    onTagsChange: (path: string, tags: string[]) => Promise<boolean>
}

function TagsEditor({
                        video,
                        existingTags,
                        onTagsChange,
                    }: {
    video: Video
    existingTags: string[]
    onTagsChange: MetadataCallbacks['onTagsChange']
}) {
    const [newTag, setNewTag] = useState('')
    const [saving, setSaving] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [dropdownStyle, setDropdownStyle] = useState<{
        top: number
        left: number
        width: number
        maxHeight: number
    } | null>(null)

    const comboRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLUListElement>(null)

    const suggestions = [
        ...new Map(
            existingTags
                .map((tag) => tag.trim())
                .filter(Boolean)
                .map((tag) => [tag.toLowerCase(), tag]),
        ).values(),
    ]
        .filter(
            (tag) =>
                !video.tags.some(
                    (existing) =>
                        existing.toLowerCase() === tag.toLowerCase(),
                ),
        )
        .filter((tag) =>
            tag.toLowerCase().includes(newTag.trim().toLowerCase()),
        )
        .sort((a, b) => a.localeCompare(b))

    useEffect(() => {
        if (!isOpen || saving || suggestions.length === 0) {
            setDropdownStyle(null)
            return
        }

        function updatePosition() {
            const input = inputRef.current
            if (!input) return

            const rect = input.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom - 8
            const spaceAbove = rect.top - 8
            const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow
            const maxHeight = Math.max(
                60,
                Math.min(180, openAbove ? spaceAbove : spaceBelow),
            )

            setDropdownStyle({
                top: openAbove
                    ? Math.max(8, rect.top - maxHeight)
                    : rect.bottom,
                left: rect.left,
                width: rect.width,
                maxHeight,
            })
        }

        updatePosition()

        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [isOpen, saving, suggestions.length])

    useEffect(() => {
        if (!isOpen) return

        function handleOutsideClick(event: PointerEvent) {
            const target = event.target
            if (!(target instanceof Node)) return

            if (
                !comboRef.current?.contains(target) &&
                !dropdownRef.current?.contains(target)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener('pointerdown', handleOutsideClick)

        return () => {
            document.removeEventListener('pointerdown', handleOutsideClick)
        }
    }, [isOpen])

    async function addTag(value = newTag) {
        const tag = value.trim()

        if (
            !tag ||
            saving ||
            video.tags.some(
                (existing) =>
                    existing.toLowerCase() === tag.toLowerCase(),
            )
        ) {
            return
        }

        setSaving(true)

        try {
            if (await onTagsChange(video.path, [...video.tags, tag])) {
                setNewTag('')
                setIsOpen(false)
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

            <div className="tag-combo" ref={comboRef}>
                <form
                    className="tag-add-form"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void addTag()
                    }}
                >
                    <input
                        ref={inputRef}
                        className="tag-input"
                        value={newTag}
                        onChange={(event) => {
                            setNewTag(event.target.value)
                            setIsOpen(true)
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setIsOpen(false)
                            }
                        }}
                        placeholder="Add tag…"
                        aria-label={`Add tag to ${video.filename}`}
                        aria-autocomplete="list"
                        aria-expanded={isOpen && suggestions.length > 0}
                        disabled={saving}
                    />
                    <button
                        type="submit"
                        className="tag-add-button"
                        disabled={saving || !newTag.trim()}
                        title="Add new tag"
                    >
                        +
                    </button>
                </form>
            </div>

            {isOpen &&
                !saving &&
                suggestions.length > 0 &&
                dropdownStyle &&
                createPortal(
                    <ul
                        ref={dropdownRef}
                        className="tag-suggestions"
                        role="listbox"
                        onWheel={(event) => {
                            event.stopPropagation()
                            const element = event.currentTarget
                            element.scrollTop += event.deltaY * 0.1
                            event.preventDefault()
                        }}
                        style={{
                            position: 'fixed',
                            top: dropdownStyle.top,
                            left: dropdownStyle.left,
                            width: dropdownStyle.width,
                            maxHeight: dropdownStyle.maxHeight,
                            overflowY: 'auto',
                            overscrollBehavior: 'contain',
                            zIndex: 99999,
                        }}
                    >
                        {suggestions.map((tag) => (
                            <li key={tag}>
                                <button
                                    type="button"
                                    role="option"
                                    className="tag-suggestion"
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onClick={() => void addTag(tag)}
                                >
                                    {tag}
                                </button>
                            </li>
                        ))}
                    </ul>,
                    document.body,
                )}
        </div>
    )
}

export function createColumns(
    selectedIds: Set<string>,
    onToggleSelection: (id: string, checked: boolean) => void,
    onPlayVideo: (path: string) => void,
    {onRatingChange, onTagsChange}: MetadataCallbacks,
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
                    existingTags={info.table
                        .getCoreRowModel()
                        .rows.flatMap((row) => row.original.tags ?? [])}
                    onTagsChange={onTagsChange}
                />
            ),
        },
        {
            accessorKey: 'rating',
            header: 'Rating',
            size: 130,
            enableSorting: true,
            cell: (info) => (
                <RatingEditor
                    video={info.row.original}
                    onRatingChange={onRatingChange}
                />
            ),
        },
    ]
}