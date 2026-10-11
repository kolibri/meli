import {useCallback, useEffect, useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import type {Playlist, Video} from '../types'

export function usePlaylists(storageDir: string | null) {
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null)
    const [playlistVideos, setPlaylistVideos] = useState<Video[]>([])
    const [playlistError, setPlaylistError] = useState('')

    const refreshPlaylists = useCallback(async () => {
        if (!storageDir) {
            setPlaylists([])
            return
        }

        try {
            const result = await invoke<Playlist[]>('load_playlists')
            setPlaylists(result)
        } catch (error) {
            setPlaylistError(String(error))
        }
    }, [storageDir])

    useEffect(() => {
        void refreshPlaylists()
    }, [refreshPlaylists])

    useEffect(() => {
        if (activePlaylistId === null) {
            setPlaylistVideos([])
            return
        }

        let cancelled = false

        invoke<Video[]>('load_playlist_videos', {
            playlistId: activePlaylistId,
        })
            .then((videos) => {
                if (!cancelled) setPlaylistVideos(videos)
            })
            .catch((error) => {
                if (!cancelled) setPlaylistError(String(error))
            })

        return () => {
            cancelled = true
        }
    }, [activePlaylistId])

    async function createPlaylist(name: string) {
        const trimmed = name.trim()
        if (!trimmed) return

        setPlaylistError('')

        try {
            await invoke('create_playlist', {name: trimmed})
            await refreshPlaylists()
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    async function renamePlaylist(playlistId: number, name: string) {
        const trimmed = name.trim()
        if (!trimmed) return

        setPlaylistError('')

        try {
            await invoke('rename_playlist', {
                playlistId,
                name: trimmed,
            })
            await refreshPlaylists()
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    async function deletePlaylist(playlistId: number) {
        setPlaylistError('')

        try {
            await invoke('delete_playlist', {playlistId})

            if (activePlaylistId === playlistId) {
                setActivePlaylistId(null)
            }

            await refreshPlaylists()
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    async function addVideosToPlaylist(
        playlistId: number,
        videoPaths: string[],
    ) {
        if (videoPaths.length === 0) return

        setPlaylistError('')

        try {
            await invoke('add_videos_to_playlist', {
                playlistId,
                videoPaths,
            })

            await refreshPlaylists()

            if (activePlaylistId === playlistId) {
                const videos = await invoke<Video[]>(
                    'load_playlist_videos',
                    {playlistId},
                )
                setPlaylistVideos(videos)
            }
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    async function removeVideoFromPlaylist(
        playlistId: number,
        videoPath: string,
    ) {
        setPlaylistError('')

        try {
            await invoke('remove_video_from_playlist', {
                playlistId,
                videoPath,
            })

            await refreshPlaylists()

            if (activePlaylistId === playlistId) {
                setPlaylistVideos((current) =>
                    current.filter((video) => video.path !== videoPath),
                )
            }
        } catch (error) {
            setPlaylistError(String(error))
        }
    }

    return {
        playlists,
        activePlaylistId,
        setActivePlaylistId,
        playlistVideos,
        playlistError,
        setPlaylistError,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addVideosToPlaylist,
        removeVideoFromPlaylist,
    }
}
