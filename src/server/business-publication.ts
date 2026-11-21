import type pg from "pg";
import { fail } from "./errors.js";
import { liveContactKeys } from "../shared/business.js";
export async function preservePublication(c: pg.PoolClient, id: string) {
  await c.query(
    `UPDATE profiles p SET published_profile=jsonb_build_object('business',p.business,'details',p.details,'category',p.category,'bio',p.bio,'zip',p.zip,'rate',p.rate,'images',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'slot',i.slot,'key',i.object_key)) FROM business_images i WHERE i.profile_id=p.id AND i.status='ready'),'[]'::jsonb)),listed=true WHERE p.id=$1 AND (p.listed OR p.review_status='approved') AND p.published_profile IS NULL`,
    [id],
  );
}
export async function releasePublication(c: pg.PoolClient, id: string) {
  await c.query(
    `INSERT INTO storage_cleanup_jobs(object_key) SELECT image->>'key' FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.published_profile->'images','[]'::jsonb)) image WHERE p.id=$1 AND NOT EXISTS(SELECT 1 FROM business_images i WHERE i.object_key=image->>'key') ON CONFLICT DO NOTHING`,
    [id],
  );
  await c.query("UPDATE profiles SET published_profile=NULL WHERE id=$1", [id]);
}
export async function publishedImage(
  c: Pick<pg.PoolClient, "query">,
  key: string,
) {
  return !!(
    await c.query(
      `SELECT 1 FROM profiles p WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p.published_profile->'images','[]'::jsonb)) image WHERE image->>'key'=$1)`,
      [key],
    )
  ).rowCount;
}
// Listing content changed. A live listing or one already in the queue is
// (re)submitted with a fresh timestamp; anything else keeps its status and
// reviewer note until its owner resubmits. Returns the business name when a
// live listing newly needs an administrator's attention.
export async function requeueReview(c: pg.PoolClient, id: string) {
  const before = (
    await c.query(
      "SELECT listed,review_status,business FROM profiles WHERE id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
  if (
    !before ||
    !(before.listed || ["pending", "approved"].includes(before.review_status))
  )
    return null;
  await c.query(
    "UPDATE profiles SET review_status='pending',review_note=NULL,submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL WHERE id=$1",
    [id],
  );
  return before.listed && before.review_status !== "pending"
    ? (before.business as string)
    : null;
}
// Phone, email and website are not reviewed content: a correction reaches
// customers immediately, even while other edits wait for review.
export async function publishContact(c: pg.PoolClient, id: string) {
  await c.query(
    `UPDATE profiles SET published_profile=jsonb_set(published_profile,'{details}',(COALESCE(published_profile->'details','{}'::jsonb) - $2::text[]) || COALESCE((SELECT jsonb_object_agg(key,value) FROM jsonb_each(details) WHERE key=ANY($2::text[])),'{}'::jsonb)) WHERE id=$1 AND published_profile IS NOT NULL`,
    [id, liveContactKeys],
  );
}
// Records an administrator's decision on exactly the submission they read.
export async function decideReview(
  c: pg.PoolClient,
  id: string,
  decision: {
    status: "approved" | "changes_requested" | "rejected";
    note: string;
    submittedAt: string;
  },
  reviewerId: string,
) {
  const profile = (
    await c.query(
      "SELECT review_status,date_trunc('milliseconds',submitted_at)=$2::timestamptz AS current FROM profiles WHERE id=$1 FOR UPDATE",
      [id, decision.submittedAt],
    )
  ).rows[0];
  if (profile?.review_status !== "pending")
    fail(409, "This profile is not awaiting review.");
  if (!profile.current)
    fail(
      409,
      "This profile changed after you opened it. Reload to review the latest version.",
    );
  if (decision.status !== "changes_requested") await releasePublication(c, id);
  await c.query(
    "UPDATE profiles SET review_status=$2,listed=($2='approved' OR ($2='changes_requested' AND published_profile IS NOT NULL)),review_note=NULLIF($3,''),reviewed_at=now(),reviewed_by=$4 WHERE id=$1",
    [id, decision.status, decision.note, reviewerId],
  );
}
