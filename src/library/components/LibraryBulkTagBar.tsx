type LibraryBulkTagBarProps = {
    selectedCount: number
    bulkTag: string
    isBulkTagging: boolean
    onBulkTagChange: (value: string) => void
    onBulkTag: () => void
}

export function LibraryBulkTagBar(
    {
        selectedCount,
        bulkTag,
        isBulkTagging,
        onBulkTagChange,
        onBulkTag,
    }: LibraryBulkTagBarProps) {
    return (
        <div className="bulk-tag-bar">
            <label htmlFor="bulk-tag-input">
                Add tag to {selectedCount} selected video(s)
            </label>

            <input
                id="bulk-tag-input"
                type="text"
                value={bulkTag}
                onChange={(event) => onBulkTagChange(event.target.value)}
                placeholder="Enter tag to add"
                disabled={isBulkTagging || selectedCount === 0}
            />

            <button
                type="button"
                onClick={onBulkTag}
                disabled={isBulkTagging || selectedCount === 0 || !bulkTag.trim()}
            >
                {isBulkTagging ? 'Adding tag…' : 'Add tag to selected'}
            </button>
        </div>
    )
}
