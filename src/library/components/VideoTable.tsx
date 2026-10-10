import { useCallback, useEffect, useRef } from 'react'
import { useTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { createColumns, features } from '../columns'
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
    selectedIds: Set<string>
    onToggleSelection: (id: string, checked: boolean) => void
    onSetSelection: (ids: string[]) => void
    onPlayVideo: (path: string) => void
    onRatingChange: (path: string, rating: number) => Promise<boolean>
    onTagsChange: (path: string, tags: string[]) => Promise<boolean>
}

export function VideoTable({
    videos,
    setVideoData,
    storageDir,
    requestedFrames,
    selectedIds,
    onToggleSelection,
    onSetSelection,
    onPlayVideo,
    onRatingChange,
    onTagsChange,
}: VideoTableProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const anchorIndexRef = useRef<number | null>(null)
    const dragAnchorRef = useRef<number | null>(null)
    const dragBaseSelectionRef = useRef<Set<string>>(new Set())
    const dragAdditiveRef = useRef(false)
    const dragActiveRef = useRef(false)
    const pointerYRef = useRef(0)
    const lastDragIndexRef = useRef<number | null>(null)

    const columns = createColumns(
        selectedIds,
        onToggleSelection,
        onPlayVideo,
        { onRatingChange, onTagsChange },
    )

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
        estimateSize: () => 250,
        overscan: 5,
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

    const selectRange = useCallback(
        (
            startIndex: number,
            endIndex: number,
            baseSelection: Set<string>,
            additive: boolean,
        ) => {
            const next = additive
                ? new Set(baseSelection)
                : new Set<string>()

            const first = Math.min(startIndex, endIndex)
            const last = Math.max(startIndex, endIndex)

            for (let index = first; index <= last; index++) {
                const row = rows[index]
                if (row) next.add(row.id)
            }

            onSetSelection([...next])
        },
        [rows, onSetSelection],
    )

    const handleRowMouseDown = useCallback(
        (
            event: React.MouseEvent<HTMLTableRowElement>,
            index: number,
            id: string,
        ) => {
            if (event.button !== 0) return

            pointerYRef.current = event.clientY
            lastDragIndexRef.current = index

            const target = event.target

            if (
                target instanceof Element &&
                target.closest(
                    'button, input, textarea, select, a, [contenteditable="true"]',
                )
            ) {
                return
            }

            event.preventDefault()

            const additive = event.ctrlKey || event.metaKey
            const range = event.shiftKey

            const anchor =
                range && anchorIndexRef.current !== null
                    ? anchorIndexRef.current
                    : index

            dragActiveRef.current = true
            dragAnchorRef.current = anchor
            dragAdditiveRef.current = additive
            dragBaseSelectionRef.current = additive
                ? new Set(selectedIds)
                : new Set()

            if (range) {
                if (anchorIndexRef.current === null) {
                    anchorIndexRef.current = index
                }

                selectRange(
                    anchor,
                    index,
                    dragBaseSelectionRef.current,
                    additive,
                )
            } else if (additive) {
                const next = new Set(selectedIds)

                if (next.has(id)) {
                    next.delete(id)
                } else {
                    next.add(id)
                }

                onSetSelection([...next])
                anchorIndexRef.current = index
            } else {
                onSetSelection([id])
                anchorIndexRef.current = index
            }
        },
        [onSetSelection, selectRange, selectedIds],
    )

    const handleRowMouseEnter = useCallback(
        (index: number) => {
            if (!dragActiveRef.current) return

            const anchor = dragAnchorRef.current
            if (anchor === null) return

            lastDragIndexRef.current = index

            selectRange(
                anchor,
                index,
                dragBaseSelectionRef.current,
                dragAdditiveRef.current,
            )
        },
        [selectRange],
    )

    function handlePointerMove(event: React.MouseEvent<HTMLDivElement>) {
        pointerYRef.current = event.clientY
    }

    useEffect(() => {
        function stopDragging() {
            dragActiveRef.current = false
            dragAnchorRef.current = null
        }

        window.addEventListener('mouseup', stopDragging)

        return () => {
            window.removeEventListener('mouseup', stopDragging)
        }
    }, [])

    useEffect(() => {
        let animationFrame = 0
        const edgeSize = 56
        const maxSpeed = 18

        function tick() {
            if (!dragActiveRef.current) {
                animationFrame = requestAnimationFrame(tick)
                return
            }

            const container = scrollRef.current

            if (container) {
                const rect = container.getBoundingClientRect()
                const pointerY = pointerYRef.current

                let speed = 0

                if (pointerY < rect.top + edgeSize) {
                    const distance = Math.max(0, pointerY - rect.top)
                    speed = -maxSpeed * (1 - distance / edgeSize)
                } else if (pointerY > rect.bottom - edgeSize) {
                    const distance = Math.max(0, rect.bottom - pointerY)
                    speed = maxSpeed * (1 - distance / edgeSize)
                }

                if (speed !== 0) {
                    container.scrollTop += speed

                    const targetOffset =
                        container.scrollTop + pointerY - rect.top

                    const targetIndex = virtualizer
                        .getVirtualItems()
                        .find(
                            (item) =>
                                targetOffset >= item.start &&
                                targetOffset < item.end,
                        )?.index

                    if (
                        targetIndex !== undefined &&
                        targetIndex !== lastDragIndexRef.current
                    ) {
                        lastDragIndexRef.current = targetIndex

                        const anchor = dragAnchorRef.current

                        if (anchor !== null) {
                            selectRange(
                                anchor,
                                targetIndex,
                                dragBaseSelectionRef.current,
                                dragAdditiveRef.current,
                            )
                        }
                    }
                }
            }

            animationFrame = requestAnimationFrame(tick)
        }

        animationFrame = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(animationFrame)
        }
    }, [selectRange, virtualizer])

    const totalHeight = virtualizer.getTotalSize()
    const paddingTop =
        virtualRows.length > 0 ? virtualRows[0].start : 0
    const paddingBottom =
        virtualRows.length > 0
            ? totalHeight - virtualRows[virtualRows.length - 1].end
            : 0

    return (
        <div
            className="library-scroll"
            ref={scrollRef}
            onMouseMove={handlePointerMove}
        >
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
                                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
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
                                const video = row.original
                                const isSelected = selectedIds.has(row.id)
                                const cells = row.getAllCells()
                                const frames = video.frames ?? []

                                return (
                                    <tr
                                        key={row.id}
                                        className={
                                            isSelected
                                                ? 'video-row-selected'
                                                : undefined
                                        }
                                        aria-selected={isSelected}
                                        style={{ height: virtualRow.size }}
                                        onMouseDown={(event) =>
                                            handleRowMouseDown(
                                                event,
                                                virtualRow.index,
                                                row.id,
                                            )
                                        }
                                        onMouseEnter={() =>
                                            handleRowMouseEnter(
                                                virtualRow.index,
                                            )
                                        }
                                    >
                                        <td
                                            colSpan={columns.length}
                                            className="video-preview-cell"
                                        >
                                            <table className="video-entry-table">
                                                <tbody>
                                                    <tr className="video-metadata-row">
                                                        {cells.map((cell) => (
                                                            <td
                                                                key={cell.id}
                                                                style={{
                                                                    width: cell.column.getSize(),
                                                                }}
                                                            >
                                                                <table.FlexRender
                                                                    cell={cell}
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>

                                                    <tr className="video-filmstrip-row">
                                                        <td colSpan={cells.length}>
                                                            <div className="filmstrip">
                                                                {Array.from(
                                                                    { length: 10 },
                                                                    (_, index) => {
                                                                        const frame =
                                                                            frames[index]

                                                                        return (
                                                                            <div
                                                                                className="filmstrip-frame"
                                                                                key={index}
                                                                            >
                                                                                {frame ? (
                                                                                    <img
                                                                                        src={frame}
                                                                                        alt={`Frame ${index + 1} from ${video.filename}`}
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
                                                                    },
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
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
