import { pool } from "./db/index.js";
import type { ReviewPage } from "../shared/reviews.js";
// Explicit public projection: never return customer IDs, addresses or project titles.
export async function publicReviews(
  proId: string,
  offset: number,
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
      `SELECT r.id,r.rating,r.body,r.reply,r.created_at AS "createdAt",p.category,
 (p.status='completed' AND p.pro_id=r.pro_id AND p.customer_id<>r.pro_id) AS "completedProject"
 FROM reviews r JOIN projects p ON p.id=r.project_id WHERE r.pro_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 10 OFFSET $2`,
      [proId, offset],
    )
  ).rows;
  return {
    reviews: rows,
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
