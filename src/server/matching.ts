import type pg from "pg";
import { fail } from "./errors.js";

// Aliases are application constants, never request values. All inputs use SQL parameters.
export function matchSql(profile = "f", project = "p") {
  return `(${profile}.service_categories ? ${project}.category OR
    (jsonb_array_length(${profile}.service_categories)=0 AND ${profile}.category=${project}.category))
    AND ${profile}.verified AND ${profile}.review_status='approved'
    AND NOT ${profile}.suspended AND ${profile}.available
    AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=${profile}.id AND s.status IN ('active','trialing'))
    AND NOT EXISTS (SELECT 1 FROM blocked b WHERE
      (b.user_id=${profile}.id AND b.other_id=${project}.customer_id) OR
      (b.other_id=${profile}.id AND b.user_id=${project}.customer_id))
    AND ((${profile}.latitude IS NOT NULL AND ${project}.latitude IS NOT NULL
      AND 3959 * acos(greatest(-1,least(1,
        cos(radians(${profile}.latitude))*cos(radians(${project}.latitude))*
        cos(radians(${project}.longitude)-radians(${profile}.longitude))+
        sin(radians(${profile}.latitude))*sin(radians(${project}.latitude))
      ))) <= ${profile}.service_radius_miles)
      OR ((${profile}.latitude IS NULL OR ${project}.latitude IS NULL) AND ${profile}.zip=${project}.zip))`;
}
export async function assertMatch(
  c: pg.PoolClient,
  proId: string,
  projectId: string,
) {
  const found = await c.query(
    `SELECT 1 FROM profiles f JOIN projects p ON p.id=$2 WHERE f.id=$1 AND ${matchSql()}`,
    [proId, projectId],
  );
  if (!found.rowCount)
    fail(
      403,
      "This project does not match the professional’s active services and service area.",
    );
}
