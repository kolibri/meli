
import { useEffect } from 'react'
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

export function useThumbnails(
    rows: VideoRow[],
    virtualRows: VirtualRow[],
    videoData: Video[],
    setVideoData: Dispatch<SetStateAction<Video[]>>,
    storageDir: string | null,
    requestedFrames: RequestedFrames,
) {
    useEffect(() => {
        if (!storageDir) return

        for (const virtualRow of virtualRows) {
            const video = rows[virtualRow.index]?.original

            if (!video || video.frames.length > 0) continue
            if (requestedFrames.current.has(video.id)) continue

            requestedFrames.current.add(video.id)

            invoke<string[]>('get_video_frames', {
                videoPath: video.path,
                duration: video.duration,
            })
                .then((frames) => {
                    setVideoData((current) =>
                        current.map((item) =>
                            item.id === video.id
                                ? { ...item, frames }
                                : item,
                        ),
                    )
                })
                .catch((error) => {
                    console.error(
                        `Could not load thumbnails for ${video.filename}:`,
                        error,
                    )
                })
        }
    }, [
        rows,
        virtualRows,
        videoData,
        setVideoData,
        storageDir,
        requestedFrames,
    ])
}
