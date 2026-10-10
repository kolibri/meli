
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


export function createColumns(
    selectedIds: Set<string>,
    onToggleSelection: (id: string, checked: boolean) => void,
    onPlayVideo: (path: string) => void,
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
                            onToggleSelection(
                                video.id,
                                event.target.checked,
                            )
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
            cell: (info) => {
                const tags = info.getValue<string[]>() ?? []

                return (
                    <div className="tags-cell">
                        {tags.length > 0
                            ? tags.map((tag, index) => (
                                <span
                                    className="tag"
                                    key={`${tag}-${index}`}
                                >
                                    {tag}
                                </span>
                            ))
                            : <span className="muted">No tags</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: 'rating',
            header: 'Rating',
            size: 110,
            cell: (info) => {
                const rating = Number(info.getValue() ?? 0)
                const boundedRating = Math.max(0, Math.min(5, rating))

                return (
                    <span
                        className="rating"
                        aria-label={`Rating ${boundedRating} out of 5`}
                    >
                        {'★'.repeat(boundedRating)}
                        <span className="rating-empty">
                            {'★'.repeat(5 - boundedRating)}
                        </span>
                    </span>
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
    ]
}
