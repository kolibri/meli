import type {Video} from '../types'

export function RatingEditor(
    {
        video,
        onRatingChange,
    }: {
        video: Video
        onRatingChange: (path: string, rating: number) => Promise<boolean>
    }) {
    const rating = Math.max(0, Math.min(5, Number(video.rating) || 0))

    return (
        <div className="rating" aria-label={`Rating ${rating} out of 5`}>
            {Array.from({length: 5}, (_, index) => {
                const star = index + 1
                const active = star <= rating

                return (
                    <button
                        key={star}
                        type="button"
                        className={`rating-star${active ? ' active' : ''}`}
                        aria-label={
                            rating === star
                                ? `Clear rating of ${star}`
                                : `Set rating to ${star}`
                        }
                        aria-pressed={rating === star}
                        onClick={() =>
                            void onRatingChange(
                                video.path,
                                rating === star ? 0 : star,
                            )
                        }
                    >
                        {active ? '★' : '☆'}
                    </button>
                )
            })}
        </div>
    )
}
