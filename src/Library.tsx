import "./Library.css";

import { useMemo, useRef, useState } from 'react'
import {
    columnSizingFeature,
    createSortedRowModel,
    rowSortingFeature,
    tableFeatures,
    useTable,
    type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

type Video = {
    id: string
    path: string
    filename: string
    size: number
    duration: number
    tags: string[]
    rating: number
    frames: string[]
}

const features = tableFeatures({
    columnSizingFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
})

function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '—'
    if (bytes < 1024) return `${bytes} B`

    const units = ['KB', 'MB', 'GB', 'TB']
    let size = bytes / 1024
    let unit = 0

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024
        unit++
    }

    return `${size.toFixed(1)} ${units[unit]}`
}

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '—'

    const total = Math.floor(seconds)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs = total % 60

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`
}


const columns: ColumnDef<typeof features, Video>[] = [
    {
        accessorKey: 'filename',
        header: 'Filename',
        size: 260,
        cell: (info) => (
            <span className="filename-cell" title={info.getValue<string>()}>
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
                        ? tags.map((tag) => (
                            <span className="tag" key={tag}>
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

            return (
                <span className="rating" aria-label={`Rating ${rating} out of 5`}>
          {'★'.repeat(Math.max(0, Math.min(5, rating)))}
                    <span className="rating-empty">
            {'★'.repeat(5 - Math.max(0, Math.min(5, rating)))}
          </span>
        </span>
            )
        },
    },
]

export function Library() {
    const [videoData, setVideoData] = useState<Video[]>([])
    const [isImporting, setIsImporting] = useState(false)
    const [importError, setImportError] = useState('')

        // Keep the rest of the existing component here.
    const [search, setSearch] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    async function handleAddFolder() {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select video folder',
        })

        if (typeof selected !== 'string') return

        setIsImporting(true)
        setImportError('')

        try {
            const found = await invoke<Video[]>('scan_video_folder', {
                folderPath: selected,
            })

            setVideoData(current => {
                const byPath = new Map(current.map(video => [video.id, video]))

                for (const video of found) {
                    byPath.set(video.id, video)
                }

                return Array.from(byPath.values())
            })
        } catch (error) {
            setImportError(String(error))
        } finally {
            setIsImporting(false)
        }
    }


    const filteredVideos = useMemo(() => {
        const query = search.trim().toLowerCase()

        if (!query) return videoData

        return videoData.filter((video) => {
            const filename = video.filename ?? ''
            const tags = video.tags ?? []

            return (
                filename.toLowerCase().includes(query) ||
                tags.some((tag) => tag.toLowerCase().includes(query))
            )
        })
    }, [search, videoData])

    const table = useTable({
        features,
        columns,
        data: filteredVideos,
        getRowId: (row) => String(row.id),
    })

    const rows = table.getRowModel().rows

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 100,
        overscan: 8,
    })

    const virtualRows = virtualizer.getVirtualItems()
    const totalHeight = virtualizer.getTotalSize()
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
    const paddingBottom =
        virtualRows.length > 0
            ? totalHeight - virtualRows[virtualRows.length - 1].end
            : 0

    return (
        <main className="library">
            <header className="library-toolbar">
                <div>
                    <h1 className="library-heading">Video Library</h1>
                    <div className="library-count">
                        {rows.length} {rows.length === 1 ? 'video' : 'videos'}
                    </div>
                </div>

                <button
                    type="button"
                    className="library-add-folder"
                    onClick={handleAddFolder}
                    disabled={isImporting}
                >
                    {isImporting ? 'Scanning…' : 'Add Folder'}
                </button>

                {importError && (
                    <p className="library-import-error" role="alert">
                        Could not scan folder: {importError}
                    </p>
                )}

                <input
                    className="library-search"
                    type="search"
                    placeholder="Search filenames and tags…"
                    aria-label="Search video library"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </header>

            <div className="library-scroll" ref={scrollRef}>
                <table className="library-table">
                    <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                const sorted = header.column.getIsSorted()

                                return (
                                    <th
                                        key={header.id}
                                        style={{
                                            width: header.getSize(),
                                            minWidth: header.getSize(),
                                        }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            header.column.getCanSort() ? (
                                                <button
                                                    type="button"
                                                    className="sort-button"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    <table.FlexRender header={header} />
                                                    <span aria-hidden="true">
                              {sorted === 'asc'
                                  ? '↑'
                                  : sorted === 'desc'
                                      ? '↓'
                                      : '↕'}
                            </span>
                                                </button>
                                            ) : (
                                                <table.FlexRender header={header} />
                                            )
                                        )}
                                    </th>
                                )
                            })}
                        </tr>
                    ))}
                    </thead>

                    <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length}>
                                <div className="library-empty">
                                    No videos match your search.
                                </div>
                            </td>
                        </tr>
                    ) : (
                        <>
                            {paddingTop > 0 && (
                                <tr aria-hidden="true">
                                    <td
                                        colSpan={columns.length}
                                        style={{
                                            height: paddingTop,
                                            padding: 0,
                                            border: 0,
                                        }}
                                    />
                                </tr>
                            )}

                            {virtualRows.map((virtualRow) => {
                                const row = rows[virtualRow.index]

                                return (
                                    <tr
                                        key={row.id}
                                        style={{ height: virtualRow.size }}
                                    >
                                        {row.getAllCells().map((cell) => (
                                            <td key={cell.id}>
                                                <table.FlexRender cell={cell} />
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}

                            {paddingBottom > 0 && (
                                <tr aria-hidden="true">
                                    <td
                                        colSpan={columns.length}
                                        style={{
                                            height: paddingBottom,
                                            padding: 0,
                                            border: 0,
                                        }}
                                    />
                                </tr>
                            )}
                        </>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    )
}

export default Library