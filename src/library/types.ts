export type Video = {
    id: string
    path: string
    filename: string
    size: number
    duration: number
    tags: string[]
    rating: number
    frames: string[]
}

export type Playlist = {
    id: number
    name: string
    videoCount: number
}