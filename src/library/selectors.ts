import type {Video} from './types'

export type RatingFilter = number | 'unrated' | null

export type AvailableTag = {
    key: string
    name: string
    count: number
}

export function getAvailableTags(videoData: Video[]): {
    availableTags: AvailableTag[]
    tagNames: Map<string, string>
} {
    const tagCounts = new Map<string, number>()
    const tagNames = new Map<string, string>()

    for (const video of videoData) {
        const tagsOnVideo = new Set<string>()

        for (const rawTag of video.tags ?? []) {
            const tag = rawTag.trim()
            if (!tag) continue

            const key = tag.toLocaleLowerCase()

            if (!tagsOnVideo.has(key)) {
                tagsOnVideo.add(key)
                tagNames.set(key, tagNames.get(key) ?? tag)
                tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1)
            }
        }
    }

    const availableTags = [...tagNames.entries()]
        .map(([key, name]) => ({
            key,
            name,
            count: tagCounts.get(key) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

    return {availableTags, tagNames}
}

export function getVideosForView({
    activePlaylistId,
    filteredVideos,
    playlistVideos,
    videoData,
    search,
}: {
    activePlaylistId: number | null
    filteredVideos: Video[]
    playlistVideos: Video[]
    videoData: Video[]
    search: string
}): Video[] {
    if (activePlaylistId === null) return filteredVideos

    const query = search.trim().toLocaleLowerCase()

    return playlistVideos
        .map(
            (playlistVideo) =>
                videoData.find(
                    (video) => video.path === playlistVideo.path,
                ) ?? playlistVideo,
        )
        .filter((video) => {
            return (
                !query ||
                video.filename.toLocaleLowerCase().includes(query) ||
                (video.tags ?? []).some((tag) =>
                    tag.toLocaleLowerCase().includes(query),
                )
            )
        })
}

export function getVisibleVideos({
    videos,
    selectedTags,
    tagMatchMode,
    untaggedOnly,
    ratingFilter,
}: {
    videos: Video[]
    selectedTags: string[]
    tagMatchMode: 'AND' | 'OR'
    untaggedOnly: boolean
    ratingFilter: RatingFilter
}): Video[] {
    return videos.filter((video) => {
        const videoTags = (video.tags ?? []).map((tag) =>
            tag.trim().toLocaleLowerCase(),
        )

        const matchesUntagged =
            !untaggedOnly || !videoTags.some((tag) => tag.length > 0)

        const matchesTags =
            selectedTags.length === 0 ||
            (tagMatchMode === 'AND'
                ? selectedTags.every((tag) => videoTags.includes(tag))
                : selectedTags.some((tag) => videoTags.includes(tag)))

        const rating = Number(video.rating) || 0
        const matchesRating =
            ratingFilter === null ||
            (ratingFilter === 'unrated'
                ? rating === 0
                : rating >= ratingFilter)

        return matchesUntagged && matchesTags && matchesRating
    })
}
