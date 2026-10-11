import {useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

export function useVideoPlayback() {
    const [playbackError, setPlaybackError] = useState('')

    async function handlePlayVideos(paths: string[]) {
        setPlaybackError('')

        try {
            await invoke<void>('open_videos_in_vlc', {paths})
        } catch (error) {
            setPlaybackError(String(error))
        }
    }

    return {
        playbackError,
        handlePlayVideos,
    }
}
