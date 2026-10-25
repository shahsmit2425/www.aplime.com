import { useEffect, useState } from "react";
import { Star, ShieldCheck } from "lucide-react";
import { request } from "./api.js";
import { T, useT, useLanguage } from "../shared/language.js";
import type { ReviewPage, PublicReview } from "../shared/reviews.js";
export function RatingPicker() {
  const [rating, setRating] = useState(0);
  const t = useT();
  return (
    <fieldset className="review-rating-picker">
      <legend>
        <T>Choose your rating</T>
      </legend>
      <div className="review-star-options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} title={`${n} / 5`}>
            <input
              type="radio"
              name="rating"
              value={n}
              required
              checked={rating === n}
              onChange={() => setRating(n)}
            />
            <Star size={32} fill={n <= rating ? "currentColor" : "none"} />
            <span className="sr-only">{n} / 5</span>
          </label>
        ))}
      </div>
      <span aria-live="polite">
        {t(
          ["Select a rating", "Poor", "Fair", "Good", "Very good", "Excellent"][
            rating
          ],
        )}
      </span>
    </fieldset>
  );
}
export function ReviewCard({
  review,
  context,
}: {
  review: Pick<PublicReview, "rating" | "body" | "reply" | "createdAt"> &
    Partial<PublicReview>;
  context?: string;
}) {
  const { language } = useLanguage();
  return (
    <article className="trusted-review">
      <header>
        <div className="review-stars" aria-label={`${review.rating} / 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={18}
              aria-hidden="true"
              fill={n <= review.rating ? "currentColor" : "none"}
            />
          ))}
          <strong>{review.rating}/5</strong>
        </div>
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString(language, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </header>
      {context && <strong>{context}</strong>}
      <div className="review-context">
        {review.completedProject && (
          <span>
            <ShieldCheck size={16} />
            <T>Completed Aplime project</T>
          </span>
        )}
        {review.category && (
          <span>
            <T>{review.category}</T>
          </span>
        )}
      </div>
      <p className="review-written-text">{review.body}</p>
      {review.reply && (
        <blockquote>
          <strong>
            <T>Business response</T>
          </strong>
          <p className="review-written-text">{review.reply}</p>
        </blockquote>
      )}
    </article>
  );
}
export function BusinessReviews({ proId }: { proId: string }) {
  const [page, setPage] = useState<ReviewPage | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null);
    setLoading(true);
    setError(false);
    request<ReviewPage>(`/professionals/${encodeURIComponent(proId)}/reviews`)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [proId, retry]);
  async function more() {
    if (page?.nextOffset == null) return;
    setLoading(true);
    setError(false);
    try {
      const next = await request<ReviewPage>(
        `/professionals/${encodeURIComponent(proId)}/reviews?offset=${page.nextOffset}`,
      );
      setPage({ ...next, reviews: [...page.reviews, ...next.reviews] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="profile-content-card business-reviews"
      id="business-reviews"
    >
      <h2>
        <T>Customer reviews</T>
      </h2>
      <p className="review-trust-note">
        <T>
          Reviews come from customers with a completed project on Aplime. This
          verifies the project connection, not payment or the quality of the
          work. Both positive and negative feedback are welcome.
        </T>
      </p>
      {page && page.total > 0 && (
        <>
          <div className="review-summary">
            <div>
              <strong>
                {page.average.toFixed(1)}
                <small> / 5</small>
              </strong>
              <span>
                {page.total} <T>reviews</T>
              </span>
            </div>
            <div className="review-distribution">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n}>
                  <span>{n} ★</span>
                  <meter
                    min={0}
                    max={page.total}
                    value={page.distribution[n - 1]}
                    aria-label={`${n} / 5`}
                  />
                  <span>{page.distribution[n - 1]}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="muted">
            <T>Newest first</T>
          </p>
          {page.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </>
      )}
      {page?.total === 0 && (
        <p>
          <T>
            No customer reviews yet. Completed projects can be reviewed by their
            customers.
          </T>
        </p>
      )}
      {loading && (
        <p role="status">
          <T>Loading reviews…</T>
        </p>
      )}
      {error && (
        <p role="alert">
          <T>Reviews could not be loaded.</T>{" "}
          <button
            className="text-button"
            onClick={() => (page ? void more() : setRetry((n) => n + 1))}
          >
            <T>Try again</T>
          </button>
        </p>
      )}
      {page?.nextOffset != null && !loading && !error && (
        <button className="secondary" onClick={() => void more()}>
          <T>Load more reviews</T>
        </button>
      )}
    </section>
  );
}
