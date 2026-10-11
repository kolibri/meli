type LibraryActiveFiltersProps = {
    selectedTags: string[]
    tagMatchMode: 'AND' | 'OR'
    untaggedOnly: boolean
    ratingFilter: number | 'unrated' | null
    tagNames: Map<string, string>
    onClear: () => void
}

export function LibraryActiveFilters(
    {
        selectedTags,
        tagMatchMode,
        untaggedOnly,
        ratingFilter,
        tagNames,
        onClear,
    }: LibraryActiveFiltersProps) {
    if (selectedTags.length === 0 && !untaggedOnly && ratingFilter === null) {
        return null
    }

    return (
        <div className="library-active-filter">
            {untaggedOnly && (
                <span>
                    Tags: <strong>Untagged</strong>
                </span>
            )}
            {selectedTags.length > 0 && (
                <span>
                    Tags ({tagMatchMode}):{' '}
                    <strong>
                        {selectedTags.map((key) => tagNames.get(key) ?? key).join(', ')}
                    </strong>
                </span>
            )}
            {ratingFilter !== null && (
                <span>
                    Rating:{' '}
                    <strong>
                        {ratingFilter === 'unrated' ? 'Not rated' : `${ratingFilter}+ stars`}
                    </strong>
                </span>
            )}
            <button type="button" onClick={onClear} title="Clear all filters">
                Clear filters
            </button>
        </div>
    )
}
