import type pg from "pg";
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
