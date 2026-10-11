import type {Dispatch, SetStateAction} from 'react'
import {useState} from 'react'
import {invoke} from '@tauri-apps/api/core'

import type {Video} from '../types'

export function useVideoMetadata(
    setVideoData: Dispatch<SetStateAction<Video[]>>,
    selectedVideos: Video[],
) {
    const [metadataError, setMetadataError] = useState('')
    const [bulkTag, setBulkTag] = useState('')
    const [isBulkTagging, setIsBulkTagging] = useState(false)

    async function handleRatingChange(
        path: string,
        rating: number,
    ): Promise<boolean> {
        setMetadataError('')

        try {
            await invoke<void>('update_video_rating', {
                videoPath: path,
                rating,
            })

            setVideoData((current) =>
                current.map((video) =>
                    video.path === path ? {...video, rating} : video,
                ),
            )

            return true
        } catch (error) {
            setMetadataError(String(error))
            return false
        }
    }

    async function handleTagsChange(
        path: string,
        tags: string[],
    ): Promise<boolean> {
        setMetadataError('')

        try {
            await invoke<void>('update_video_tags', {
                videoPath: path,
                tags,
            })

            setVideoData((current) =>
                current.map((video) =>
                    video.path === path ? {...video, tags} : video,
                ),
            )

            return true
        } catch (error) {
            setMetadataError(String(error))
            return false
        }
    }

    async function handleBulkTag() {
        const tagToAdd = bulkTag.trim()

        if (!tagToAdd || selectedVideos.length === 0 || isBulkTagging) {
            return
        }

        setIsBulkTagging(true)
        setMetadataError('')

        const updatedTags = new Map<string, string[]>()
        const failures: string[] = []

        try {
            for (const video of selectedVideos) {
                const existingTags = video.tags ?? []
                const alreadyHasTag = existingTags.some(
                    (tag) =>
                        tag.trim().toLocaleLowerCase() ===
                        tagToAdd.toLocaleLowerCase(),
                )

                if (alreadyHasTag) {
                    continue
                }

                const nextTags = [...existingTags, tagToAdd]

                try {
                    await invoke<void>('update_video_tags', {
                        videoPath: video.path,
                        tags: nextTags,
                    })
                    updatedTags.set(video.path, nextTags)
                } catch (error) {
                    failures.push(`${video.filename}: ${String(error)}`)
                }
            }

            if (updatedTags.size > 0) {
                setVideoData((current) =>
                    current.map((video) => {
                        const tags = updatedTags.get(video.path)
                        return tags ? {...video, tags} : video
                    }),
                )
            }

            if (failures.length > 0) {
                setMetadataError(
                    `Added "${tagToAdd}" to ${updatedTags.size} video(s). ` +
                        `${failures.length} update(s) failed:\n${failures.join('\n')}`,
                )
            } else {
                setMetadataError(
                    updatedTags.size > 0
                        ? `Added "${tagToAdd}" to ${updatedTags.size} video(s).`
                        : `All selected videos already have the tag "${tagToAdd}".`,
                )
                setBulkTag('')
            }
        } finally {
            setIsBulkTagging(false)
        }
    }

    return {
        metadataError,
        setMetadataError,
        bulkTag,
        setBulkTag,
        isBulkTagging,
        handleRatingChange,
        handleTagsChange,
        handleBulkTag,
    }
}
