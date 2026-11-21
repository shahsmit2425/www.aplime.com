import type { PoolClient } from "pg";
import { fail } from "./errors.js";
import { reviewPhotos } from "./review-images.js";
import { pool } from "./db/index.js";
import type { ReviewPage, ReviewSort } from "../shared/reviews.js";
const order: Record<ReviewSort, string> = {
  newest: "r.created_at DESC,r.id DESC",
  highest: "r.rating DESC,r.created_at DESC,r.id DESC",
  lowest: "r.rating ASC,r.created_at DESC,r.id DESC",
};
// Explicit public projection: never return customer IDs, addresses or project titles.
// A name and town appear only on reviews whose customer chose to publish them.
export async function publicReviews(
  proId: string,
  offset: number,
  sort: ReviewSort = "newest",
): Promise<ReviewPage> {
  const summary = (
    await pool.query(
      `SELECT count(*)::int AS total,coalesce(avg(rating),0)::float AS average,
 count(*) FILTER(WHERE rating=1)::int AS one,count(*) FILTER(WHERE rating=2)::int AS two,count(*) FILTER(WHERE rating=3)::int AS three,count(*) FILTER(WHERE rating=4)::int AS four,count(*) FILTER(WHERE rating=5)::int AS five FROM reviews WHERE pro_id=$1`,
      [proId],
    )
  ).rows[0];
  const rows = (
    await pool.query(
      `SELECT r.project_id,r.id,r.rating,r.body,r.reply,r.replied_at AS "repliedAt",r.created_at AS "createdAt",p.category,
 (p.status='completed' AND p.pro_id=r.pro_id AND p.customer_id<>r.pro_id) AS "completedProject",
 r.reviewer_name AS reviewer,
 CASE WHEN r.reviewer_name IS NOT NULL AND p.town<>'' THEN concat_ws(', ',p.town,nullif(p.region,'')) END AS town
 FROM reviews r JOIN projects p ON p.id=r.project_id WHERE r.pro_id=$1 ORDER BY ${order[sort]} LIMIT 10 OFFSET $2`,
      [proId, offset],
    )
  ).rows;
  return {
    reviews: await Promise.all(
      rows.map(async ({ project_id, ...row }) => ({
        ...row,
        photos: await reviewPhotos(project_id),
      })),
    ),
    total: summary.total,
    average: summary.average,
    distribution: [
      summary.one,
      summary.two,
      summary.three,
      summary.four,
      summary.five,
    ],
    nextOffset:
      offset + rows.length < summary.total ? offset + rows.length : null,
  };
}

// The conditional update makes simultaneous or repeated replies first-write-only.
export async function submitReviewReply(
  c: Pick<PoolClient, "query">,
  id: string,
  proId: string,
  reply: string,
) {
  const result = await c.query(
    "UPDATE reviews SET reply=$3,replied_at=now() WHERE id=$1 AND pro_id=$2 AND reply IS NULL RETURNING project_id",
    [id, proId, reply],
  );
  if (!result.rows[0])
    fail(
      403,
      "You can reply only once to your own reviews. Published replies cannot be changed.",
    );
  return result.rows[0].project_id as string;
}
