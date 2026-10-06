import { transaction } from "./db/index.js";
import { notifyMany } from "./repository.js";
import { recordProjectActivity } from "./project-events.js";

// Expires lapsed estimates on open projects so customers never see or accept stale prices.
export async function expireEstimates(limit = 50) {
  return transaction(async (c) => {
    const projects = (
      await c.query(
        `SELECT p.id,p.title,p.customer_id FROM projects p WHERE p.status IN ('requested','quoted')
         AND EXISTS (SELECT 1 FROM quotes q WHERE q.project_id=p.id AND q.status='pending' AND q.expires_at<=now())
         ORDER BY p.created_at LIMIT $1 FOR UPDATE OF p SKIP LOCKED`,
        [limit],
      )
    ).rows;
    for (const p of projects) {
      const expired = (
        await c.query(
          "UPDATE quotes SET status='expired',revision=revision+1 WHERE project_id=$1 AND status='pending' AND expires_at<=now() RETURNING pro_id",
          [p.id],
        )
      ).rows;
      await c.query(
        "UPDATE projects SET version=version+1,status=CASE WHEN EXISTS(SELECT 1 FROM quotes WHERE project_id=$1 AND status='pending') THEN 'quoted' ELSE 'requested' END WHERE id=$1",
        [p.id],
      );
      for (const q of expired)
        await recordProjectActivity(
          c,
          p.id,
          q.pro_id,
          "estimate_expired",
          "Estimate expired",
        );
      const target = { page: "project", id: p.id as string };
      await notifyMany(
        c,
        expired.map((q) => q.pro_id as string),
        "Estimate expired",
        `Your estimate for ${p.title} expired. Send a new estimate if the project is still open.`,
        target,
      );
      await notifyMany(
        c,
        [p.customer_id],
        "An estimate expired",
        `${p.title}: ${expired.length === 1 ? "an estimate has" : expired.length + " estimates have"} expired. Review the remaining estimates or wait for new ones.`,
        target,
      );
    }
    return projects.length;
  });
}
