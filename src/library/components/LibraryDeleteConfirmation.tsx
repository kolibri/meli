import type {Video} from '../types'

type LibraryDeleteConfirmationProps = {
    pendingDelete: Video[]
    isDeleting: boolean
    onCancel: () => void
    onConfirm: () => void
}

export function LibraryDeleteConfirmation(
    {
        pendingDelete,
        isDeleting,
        onCancel,
        onConfirm,
    }: LibraryDeleteConfirmationProps) {
    return (
        <div className="delete-confirmation-backdrop">
            <section
                className="delete-confirmation-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-confirmation-title"
                aria-describedby="delete-confirmation-description"
            >
                <h2 id="delete-confirmation-title">Permanently delete files?</h2>

                <p id="delete-confirmation-description">
                    You are about to permanently delete{' '}
                    <strong>{pendingDelete.length}</strong>{' '}
                    {pendingDelete.length === 1 ? 'file' : 'files'} from your filesystem. This cannot be undone.
                </p>

                <ul className="delete-confirmation-file-list">
                    {pendingDelete.slice(0, 8).map((video) => (
                        <li key={video.path}>{video.filename}</li>
                    ))}
                </ul>

                {pendingDelete.length > 8 && (
                    <p>
                        And {pendingDelete.length - 8} more{' '}
                        {pendingDelete.length - 8 === 1 ? 'file' : 'files'}.
                    </p>
                )}

                <div className="delete-confirmation-actions">
                    <button type="button" onClick={onCancel} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="delete-confirmation-danger"
                        onClick={onConfirm}
                        disabled={isDeleting || pendingDelete.length === 0}
                    >
                        {isDeleting ? 'Deleting…' : 'Permanently delete'}
                    </button>
                </div>
            </section>
        </div>
    )
}
