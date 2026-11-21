import { ReviewPhotoGallery } from "./review-photos.js";
import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, MessageSquareReply, Star, UserRound } from "lucide-react";
import { request } from "./api.js";
import { T, useT } from "../shared/language.js";
import type {
  ReviewPage,
  PublicReview,
  ReviewSort,
} from "../shared/reviews.js";
const day = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const ratingLabels = [
  "Select a rating",
  "Poor",
  "Fair",
  "Good",
  "Very good",
  "Excellent",
];
// Outlined stars with a filled row on top, clipped to the score in half-star steps.
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const row = (fill: string) =>
    [1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} fill={fill} aria-hidden="true" />
    ));
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`${Number.isInteger(value) ? value : value.toFixed(1)} / 5`}
      data-score={Math.max(0, Math.min(10, Math.round(value * 2)))}
    >
      <span>{row("none")}</span>
      <span className="review-stars-fill">{row("currentColor")}</span>
    </span>
  );
}
export function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const t = useT();
  return (
    <fieldset className="review-rating-picker">
      <legend>
        <T>Choose your rating</T>
      </legend>
      <div className="review-star-options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            title={`${n} / 5`}
            className={n <= value ? "selected" : undefined}
          >
            <input
              type="radio"
              name="rating"
              value={n}
              required
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <Star size={34} fill={n <= value ? "currentColor" : "none"} />
            <span className="sr-only">
              {n} / 5 — {t(ratingLabels[n])}
            </span>
          </label>
        ))}
      </div>
      <span aria-live="polite" className={value ? "rated" : undefined}>
        {t(ratingLabels[value])}
      </span>
    </fieldset>
  );
}
export function ReviewCard({
  review,
  context,
  business,
  children,
}: {
  review: Pick<PublicReview, "rating" | "body" | "reply" | "createdAt"> &
    Partial<PublicReview>;
  context?: string;
  business?: string;
  children?: ReactNode;
}) {
  const t = useT();
  const place = [review.town, review.category && t(review.category)]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="review-card">
      <header>
        <span className="review-avatar" aria-hidden="true">
          {review.reviewer ? review.reviewer[0] : <UserRound size={20} />}
        </span>
        <div className="review-author">
          <strong>{review.reviewer || <T>Aplime customer</T>}</strong>
          {place && <small>{place}</small>}
        </div>
        {review.completedProject && (
          <span
            className="review-verified"
            title={t(
              "This customer completed a project with this business on Aplime.",
            )}
          >
            <BadgeCheck size={15} />
            <T>Hired on Aplime</T>
          </span>
        )}
      </header>
      <div className="review-rating-line">
        <Stars value={review.rating} />
        <strong>{review.rating}/5</strong>
        <time dateTime={review.createdAt}>{day(review.createdAt)}</time>
      </div>
      {context && <p className="review-project">{context}</p>}
      <p className="review-written-text">{review.body}</p>
      {!!review.photos?.length && <ReviewPhotoGallery photos={review.photos} />}
      {children}
      {review.reply && (
        <blockquote className="review-response">
          <header>
            <MessageSquareReply size={16} />
            <strong>
              {business ? (
                `${t("Response from")} ${business}`
              ) : (
                <T>Business response</T>
              )}
            </strong>
            {review.repliedAt && (
              <time dateTime={review.repliedAt}>{day(review.repliedAt)}</time>
            )}
          </header>
          <p className="review-written-text">{review.reply}</p>
        </blockquote>
      )}
    </article>
  );
}
export function ReviewSummary({
  average,
  total,
  distribution,
}: Pick<ReviewPage, "average" | "total" | "distribution">) {
  return (
    <div className="review-summary">
      <div className="review-score">
        <strong>{average.toFixed(1)}</strong>
        <Stars value={average} size={20} />
        <span>
          {total} <T>{total === 1 ? "review" : "reviews"}</T>
        </span>
      </div>
      <div className="review-distribution">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n}>
            <span>{n} ★</span>
            <meter
              min={0}
              max={total}
              value={distribution[n - 1]}
              aria-label={`${n} / 5`}
            />
            <span>{distribution[n - 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ReviewRules() {
  return (
    <details className="review-rules">
      <summary>
        <BadgeCheck size={17} />
        <T>How Aplime reviews work</T>
      </summary>
      <ul>
        <li>
          <T>
            Only customers with a completed Aplime project can leave a review —
            one review per project.
          </T>
        </li>
        <li>
          <T>
            Reviews are final once published. A business can’t edit or remove a
            review; it can post one public response.
          </T>
        </li>
        <li>
          <T>
            Reviews are each customer’s own opinion. Aplime doesn’t verify
            payment or the quality of the work.
          </T>
        </li>
      </ul>
    </details>
  );
}
const sortLabels: Record<ReviewSort, string> = {
  newest: "Newest",
  highest: "Highest rated",
  lowest: "Lowest rated",
};
export function BusinessReviews({
  proId,
  business,
}: {
  proId: string;
  business?: string;
}) {
  const [page, setPage] = useState<ReviewPage | null>(null),
    [sort, setSort] = useState<ReviewSort>("newest"),
    [error, setError] = useState<"" | "load" | "more">(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const t = useT();
  const path = `/professionals/${encodeURIComponent(proId)}/reviews?sort=${sort}`;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request<ReviewPage>(path)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError("load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, retry]);
  async function more() {
    if (page?.nextOffset == null) return;
    setLoading(true);
    setError("");
    try {
      const next = await request<ReviewPage>(
        `${path}&offset=${page.nextOffset}`,
      );
      setPage({ ...next, reviews: [...page.reviews, ...next.reviews] });
    } catch {
      setError("more");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="profile-content-card business-reviews"
      id="business-reviews"
    >
      <div className="business-reviews-heading">
        <h2>
          <T>Customer reviews</T>
        </h2>
        {page && page.total > 1 && (
          <label>
            <span>
              <T>Sort by</T>
            </span>
            <select
              value={sort}
              disabled={loading}
              onChange={(e) => setSort(e.target.value as ReviewSort)}
            >
              {(Object.keys(sortLabels) as ReviewSort[]).map((key) => (
                <option key={key} value={key}>
                  {t(sortLabels[key])}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {page && page.total > 0 && (
        <>
          <ReviewSummary
            average={page.average}
            total={page.total}
            distribution={page.distribution}
          />
          <div className="review-list" aria-busy={loading}>
            {page.reviews.map((r) => (
              <ReviewCard key={r.id} review={r} business={business} />
            ))}
          </div>
        </>
      )}
      {page?.total === 0 && (
        <p className="review-none">
          <T>
            No customer reviews yet. Reviews appear here after a customer
            completes a project with this business on Aplime.
          </T>
        </p>
      )}
      {loading && !page && (
        <p role="status">
          <T>Loading reviews…</T>
        </p>
      )}
      {error && (
        <p role="alert">
          <T>Reviews could not be loaded.</T>{" "}
          <button
            className="text-button"
            onClick={() =>
              error === "more" ? void more() : setRetry((n) => n + 1)
            }
          >
            <T>Try again</T>
          </button>
        </p>
      )}
      {page?.nextOffset != null && !error && (
        <button
          className="secondary"
          disabled={loading}
          onClick={() => void more()}
        >
          <T>{loading ? "Loading reviews…" : "Load more reviews"}</T>
        </button>
      )}
      <ReviewRules />
    </section>
  );
}
