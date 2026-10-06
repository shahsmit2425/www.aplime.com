import type pg from "pg";
import { pool } from "./db/index.js";
import { fail } from "./errors.js";
import { env } from "./config.js";

// Preview relaxes authenticated listing visibility only, never action authorization.
// Explicit false restores normal discovery; production/stagging cannot enable it.
export function marketplacePreview() {
  return (
    env.APP_ENV === "development" &&
    env.MARKETPLACE_DISCOVERY_MODE === "open" &&
    env.MARKETPLACE_PREVIEW !== "false"
  );
}

export function eligibleProSql(profile = "f") {
  return `${profile}.verified AND ${profile}.review_status='approved'
    AND NOT ${profile}.suspended AND ${profile}.available
    AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=${profile}.id AND s.status IN ('active','trialing'))`;
}
export function unblockedSql(profile = "f", customer = "p.customer_id") {
  return `NOT EXISTS (SELECT 1 FROM blocked b WHERE
    (b.user_id=${profile}.id AND b.other_id=${customer}) OR
    (b.other_id=${profile}.id AND b.user_id=${customer}))`;
}

// Discovery can be broadened temporarily; notifications still use matchSql.
export function discoverySql(profile = "f", project = "p") {
  return env.MARKETPLACE_DISCOVERY_MODE === "open"
    ? `${eligibleProSql(profile)} AND ${unblockedSql(profile, project + ".customer_id")}`
    : matchSql(profile, project);
}

// Aliases are application constants, never request values. All inputs use SQL parameters.
export function matchSql(profile = "f", project = "p") {
  return `(${profile}.service_categories ? ${project}.category OR
    (jsonb_array_length(${profile}.service_categories)=0 AND ${profile}.category=${project}.category))
    AND ${eligibleProSql(profile)} AND ${unblockedSql(profile, project + ".customer_id")}
    AND ((${profile}.latitude IS NOT NULL AND ${project}.latitude IS NOT NULL
      AND ${distanceSql(profile, project)} <= ${profile}.service_radius_miles)
      OR ((${profile}.latitude IS NULL OR ${project}.latitude IS NULL) AND ${profile}.zip=${project}.zip))`;
}
// Great-circle miles between a profile and a project; NULL when either has no coordinates.
export function distanceSql(profile = "f", project = "p") {
  return `(CASE WHEN ${profile}.latitude IS NOT NULL AND ${project}.latitude IS NOT NULL THEN 3959 * acos(greatest(-1,least(1,
        cos(radians(${profile}.latitude))*cos(radians(${project}.latitude))*
        cos(radians(${project}.longitude)-radians(${profile}.longitude))+
        sin(radians(${profile}.latitude))*sin(radians(${project}.latitude))
      ))) END)`;
}
// Review-volume-aware ranking: a Bayesian average (prior of four 4-star reviews) beats a single 5-star review, then nearer pros, then a stable id order.
export function rankSql(profile = "f", project = "p") {
  return `(SELECT (coalesce(sum(r.rating),0)+16.0)/(count(r.rating)+4) FROM reviews r WHERE r.pro_id=${profile}.id) DESC,${distanceSql(profile, project)} ASC NULLS LAST,${profile}.id`;
}
export async function assertMatch(
  c: pg.PoolClient,
  proId: string,
  projectId: string,
) {
  const found = await c.query(
    `SELECT 1 FROM profiles f JOIN projects p ON p.id=$2 WHERE f.id=$1 AND ${discoverySql()}`,
    [proId, projectId],
  );
  if (!found.rowCount)
    fail(
      403,
      env.MARKETPLACE_DISCOVERY_MODE === "open"
        ? "This professional is not currently eligible to respond to this project."
        : "This project does not match the professional’s active services and service area.",
    );
}
// Open requests a professional may inspect before quoting: matching leads and requests they already quoted.
export async function isOpenLead(proId: string, projectId: string) {
  const found = await pool.query(
    `SELECT 1 FROM profiles f JOIN projects p ON p.id=$2 WHERE f.id=$1 AND p.pro_id IS NULL AND p.status IN ('requested','quoted')
     AND (${discoverySql()} OR EXISTS(SELECT 1 FROM quotes own_quote WHERE own_quote.project_id=p.id AND own_quote.pro_id=f.id AND own_quote.status='pending'))`,
    [proId, projectId],
  );
  return !!found.rowCount;
}
// Rejects accounts that share a normalized email (plus-tags and Gmail dots ignored) so nobody hires or reviews themselves.
export async function assertIndependentParties(
  c: pg.PoolClient,
  customerId: string,
  proId: string,
) {
  const same = await c.query(
    `WITH norm AS (
       SELECT u.id,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
           THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')||'@gmail.com'
           ELSE split_part(split_part(lower(u.email),'@',1),'+',1)||'@'||split_part(lower(u.email),'@',2) END AS email
       FROM users u WHERE u.id IN ($1,$2))
     SELECT 1 FROM norm a JOIN norm b ON a.id=$1 AND b.id=$2 AND a.email=b.email`,
    [customerId, proId],
  );
  if (same.rowCount)
    fail(409, "A professional cannot be hired or reviewed by the same person.");
}
