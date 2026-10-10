
import { useRef } from 'react'
import { useTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { columns, features } from '../columns'
import { useThumbnails } from '../hooks/useThumbnails'
import type { Video } from '../types'

type RequestedFrames = {
    current: Set<string>
}

type VideoTableProps = {
    videos: Video[]
    setVideoData: React.Dispatch<React.SetStateAction<Video[]>>
    storageDir: string | null
    requestedFrames: RequestedFrames
}

export function VideoTable({
                               videos,
                               setVideoData,
                               storageDir,
                               requestedFrames,
                           }: VideoTableProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    const table = useTable({
        features,
        columns,
        data: videos,
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

    useThumbnails(
        rows,
        virtualRows,
        videos,
        setVideoData,
        storageDir,
        requestedFrames,
    )

    const totalHeight = virtualizer.getTotalSize()
    const paddingTop =
        virtualRows.length > 0 ? virtualRows[0].start : 0
    const paddingBottom =
        virtualRows.length > 0
            ? totalHeight - virtualRows[virtualRows.length - 1].end
            : 0

    return (
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
                                                <table.FlexRender
                                                    header={header}
                                                />
                                                <span aria-hidden="true">
                                                        {sorted === 'asc'
                                                            ? '↑'
                                                            : sorted === 'desc'
                                                                ? '↓'
                                                                : '↕'}
                                                    </span>
                                            </button>
                                        ) : (
                                            <table.FlexRender
                                                header={header}
                                            />
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
                                            <table.FlexRender
                                                cell={cell}
                                            />
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
    )
}
