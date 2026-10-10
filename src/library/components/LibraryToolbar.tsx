type LibraryToolbarProps = {
    videoCount: number
    storageDir: string | null
    storageLoading: boolean
    storageError: string
    onChooseStorage: () => void
    isImporting: boolean
    importError: string
    onAddFolder: () => void
    search: string
    onSearchChange: (value: string) => void
    selectedCount: number
    onPlaySelected: () => void
    onSelectVisible: () => void
    onClearSelection: () => void
    playbackError: string
    metadataError: string
}

export function LibraryToolbar({
                                   videoCount,
                                   storageDir,
                                   storageLoading,
                                   storageError,
                                   onChooseStorage,
                                   isImporting,
                                   importError,
                                   onAddFolder,
                                   search,
                                   onSearchChange,
                                   selectedCount,
                                   onPlaySelected,
                                   onSelectVisible,
                                   onClearSelection,
                                   playbackError,
                                   metadataError
                               }: LibraryToolbarProps) {
    return (
        <header className="library-toolbar">
            <div>
                <h1 className="library-heading">Video Library</h1>
                <div className="library-count">
                    {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                </div>
            </div>

            <div className="library-storage">
                <div className="library-storage-info">
                    <strong>Storage</strong>
                    <span title={storageDir ?? undefined}>
                        {storageLoading
                            ? 'Loading…'
                            : storageDir ?? 'Not configured'}
                    </span>
                </div>

                <button
                    type="button"
                    className="library-add-folder"
                    onClick={onChooseStorage}
                    disabled={storageLoading}
                >
                    {storageDir ? 'Change Storage' : 'Choose Storage'}
                </button>
            </div>

            {storageError && (
                <p className="library-import-error" role="alert">
                    Storage error: {storageError}
                </p>
            )}

            <button
                type="button"
                className="library-add-folder"
                onClick={onAddFolder}
                disabled={isImporting || storageLoading || !storageDir}
            >
                {isImporting ? 'Scanning…' : 'Add Folder'}
            </button>

            {importError && (
                <p className="library-import-error" role="alert">
                    Could not scan folder: {importError}
                </p>
            )}

            <div className="library-playback-controls">
                <button
                    type="button"
                    onClick={onPlaySelected}
                    disabled={selectedCount === 0}
                >
                    Play selected ({selectedCount})
                </button>

                <button
                    type="button"
                    onClick={onSelectVisible}
                >
                    Select visible
                </button>

                <button
                    type="button"
                    onClick={onClearSelection}
                    disabled={selectedCount === 0}
                >
                    Clear selection
                </button>
            </div>

            {playbackError && (
                <p className="library-import-error" role="alert">
                    Could not open VLC: {playbackError}
                </p>
            )}

            {metadataError && (
                <p className="library-import-error" role="alert">
                    Could not save rating or tags: {metadataError}
                </p>
            )}

            <input
                className="library-search"
                type="search"
                placeholder="Search filenames and tags…"
                aria-label="Search video library"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
            />
        </header>
    )
}