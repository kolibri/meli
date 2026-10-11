export function formatSize(bytes: number): string {
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

export function formatDuration(seconds: number): string {
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
