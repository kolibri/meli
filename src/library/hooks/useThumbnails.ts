import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'

import type { Video } from '../types'

type RequestedFrames = {
    current: Set<string>
}

type VideoRow = {
    original: Video
}

type VirtualRow = {
    index: number
}

const MAX_CONCURRENT_REQUESTS = 1
const UPDATE_BATCH_SIZE = 1

export function useThumbnails(
    rows: VideoRow[],
    virtualRows: VirtualRow[],
    _videoData: Video[],
    setVideoData: Dispatch<SetStateAction<Video[]>>,
    storageDir: string | null,
    requestedFrames: RequestedFrames,
) {
    const queueRef = useRef<Video[]>([])
    const runningRef = useRef(0)
    const pendingFramesRef = useRef(new Map<string, string[]>())
    const setVideoDataRef = useRef(setVideoData)

    useEffect(() => {
        setVideoDataRef.current = setVideoData
    }, [setVideoData])

    useEffect(() => {
        if (!storageDir) return

        // Queue thumbnails for currently visible rows.
        for (const virtualRow of virtualRows) {
            const video = rows[virtualRow.index]?.original

            if (!video || video.frames.length > 0) continue
            if (requestedFrames.current.has(video.id)) continue

            requestedFrames.current.add(video.id)
            queueRef.current.push(video)
        }

        function flushUpdates() {
            const updates = pendingFramesRef.current

            if (updates.size === 0) return

            pendingFramesRef.current = new Map()

            setVideoDataRef.current((current) =>
                current.map((video) => {
                    const frames = updates.get(video.id)

                    return frames
                        ? { ...video, frames }
                        : video
                }),
            )
        }

        async function processQueue() {
            while (queueRef.current.length > 0) {
                const video = queueRef.current.shift()

                if (!video) continue

                try {
                    const frames = await invoke<string[]>(
                        'get_video_frames',
                        {
                            videoPath: video.path,
                            duration: video.duration,
                        },
                    )

                    pendingFramesRef.current.set(video.id, frames)

                    if (
                        pendingFramesRef.current.size >=
                        UPDATE_BATCH_SIZE
                    ) {
                        flushUpdates()
                    }
                } catch (error) {
                    // Allow a failed request to be retried later.
                    requestedFrames.current.delete(video.id)

                    console.error(
                        `Could not load thumbnails for ${video.filename}:`,
                        error,
                    )
                }
            }

            flushUpdates()
        }

        function startWorkers() {
            while (
                runningRef.current < MAX_CONCURRENT_REQUESTS &&
                queueRef.current.length > 0
            ) {
                runningRef.current++

                void processQueue().finally(() => {
                    runningRef.current--
                    startWorkers()
                })
            }
        }

        startWorkers()
    }, [rows, virtualRows, storageDir, requestedFrames])
}
