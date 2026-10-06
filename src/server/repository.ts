import {
  matchSql,
  rankSql,
  discoverySql,
  eligibleProSql,
  unblockedSql,
  marketplacePreview,
} from "./matching.js";
import { env } from "./config.js";
import { imageUrl } from "./integrations/storage.js";
import { randomUUID } from "node:crypto";
import { pool, camel } from "./db/index.js";
import type pg from "pg";
import type { User, Workspace, Profile, Project } from "../shared/domain.js";
import { fail } from "./errors.js";
export const profileSelect = `SELECT p.id,u.name,p.business,p.details,p.category,p.bio,p.zip,p.rate,p.available,p.availability,p.verified,p.suspended,p.connect_ready,p.service_radius_miles,p.address,p.place_id,p.service_categories,p.weekly_hours,p.time_zone,p.review_status,p.review_note,p.submitted_at,p.reviewed_at,
 COALESCE((SELECT json_agg(json_build_object('id',i.id,'slot',i.slot,'key',i.object_key) ORDER BY i.slot) FROM business_images i WHERE i.profile_id=p.id AND i.status='ready'),'[]'::json) AS images,
 COALESCE((SELECT avg(r.rating)::float FROM reviews r WHERE r.pro_id=p.id),0) AS rating,
 (SELECT count(*)::int FROM reviews r WHERE r.pro_id=p.id) AS review_count FROM profiles p JOIN users u ON u.id=p.id`;
async function mappedProfile(
  row: Record<string, any>,
  ownerId?: string,
  signedImages = false,
  administrator = false,
) {
  const profile = camel<Profile>(row);
  profile.images = await Promise.all(
    (row.images || []).map(async (i: any) => ({
      id: i.id,
      slot: i.slot,
      url:
        profile.id === ownerId || signedImages
          ? await imageUrl(i.key)
          : env.API_URL.replace(/\/$/, "") + "/api/business-images/" + i.id,
    })),
  );
  if (profile.id !== ownerId) {
    profile.address = "";
    profile.placeId = "";
  }
  if (profile.id !== ownerId && !administrator) {
    delete profile.reviewNote;
    delete profile.submittedAt;
    delete profile.reviewedAt;
    delete profile.connectReady;
  }
  if (!profile.serviceCategories.length)
    profile.serviceCategories = [profile.category];
  return profile;
}
export async function publicProfiles(id?: string) {
  const { rows } = await pool.query(
    profileSelect +
      " WHERE p.verified=true AND p.review_status='approved' AND p.suspended=false AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=p.id AND s.status IN ('active','trialing'))" +
      (id ? " AND p.id=$1" : " ORDER BY p.business LIMIT 200"),
    id ? [id] : [],
  );
  return Promise.all(rows.map((r) => mappedProfile(r)));
}
export async function workspace(user: User): Promise<Workspace> {
  const preview = marketplacePreview();
  const openDiscovery = preview || env.MARKETPLACE_DISCOVERY_MODE === "open";
  const visiblePro = preview ? "NOT p.suspended" : eligibleProSql("p");
  const admin = user.role === "admin",
    params = admin ? [] : [user.id];
  const projectWhere = admin ? "" : " WHERE p.customer_id=$1 OR p.pro_id=$1";
  const projects = (
    await pool.query(
      "SELECT p.*," +
        (admin
          ? "false"
          : "EXISTS(SELECT 1 FROM project_archives a WHERE a.project_id=p.id AND a.user_id=$1)") +
        " AS archived,c.name AS customer_name,u.name AS pro_name FROM projects p JOIN users c ON c.id=p.customer_id LEFT JOIN users u ON u.id=p.pro_id" +
        projectWhere +
        " ORDER BY p.created_at DESC LIMIT 500",
      params,
    )
  ).rows.map((r) => camel<Project>(r));
  const ids = projects.map((p) => p.id);
  const matchRows =
    user.role === "customer"
      ? (
          await pool.query(
            `SELECT p.id AS project_id, chosen.id AS pro_id FROM projects p CROSS JOIN LATERAL (
      SELECT f.id FROM profiles f WHERE ${matchSql()} AND p.pro_id IS NULL AND p.status IN ('requested','quoted')
      ORDER BY ${rankSql()} LIMIT 5
    ) chosen WHERE p.customer_id=$1`,
            [user.id],
          )
        ).rows
      : [];
  const matchedIds = [...new Set(matchRows.map((row) => row.pro_id))];
  const profileRows = (
    await pool.query(
      profileSelect.replace(
        "SELECT p.id",
        user.role === "customer" && openDiscovery
          ? `SELECT (${visiblePro} AND ${unblockedSql("p", "$1")}) AS discoverable,(${eligibleProSql("p")} AND ${unblockedSql("p", "$1")}) AS can_respond,p.id`
          : "SELECT false AS discoverable,p.id",
      ) +
        (admin
          ? ""
          : user.role === "pro"
            ? " WHERE p.id=$1"
            : ` WHERE (${openDiscovery ? `(${visiblePro} AND ${unblockedSql("p", "$1")}) OR ` : ""}p.id=ANY($2::text[]) OR p.id IN (SELECT pro_id FROM projects WHERE customer_id=$1) OR p.id IN (SELECT d.pro_id FROM project_discussions d JOIN projects pj ON pj.id=d.project_id WHERE pj.customer_id=$1) OR p.id IN (SELECT q.pro_id FROM quotes q JOIN projects pj ON pj.id=q.project_id WHERE pj.customer_id=$1) OR (NOT p.suspended AND ${unblockedSql("p", "$1")} AND p.id IN (SELECT pro_id FROM saved WHERE user_id=$1)))`) +
        (preview && user.role === "customer"
          ? " ORDER BY p.business,p.id"
          : " ORDER BY p.business LIMIT 500"),
      admin ? [] : user.role === "customer" ? [user.id, matchedIds] : [user.id],
    )
  ).rows;
  const profiles = await Promise.all(
    profileRows.map(async (r) => {
      // Every workspace viewer is authenticated and already authorized to see
      // this profile, so images use short-lived signed URLs; the public
      // redirect route stays reserved for fully approved public listings.
      const profile = await mappedProfile(r, user.id, true, admin);
      profile.matchedProjectIds = matchRows
        .filter((row) => row.pro_id === profile.id)
        .map((row) => row.project_id);
      return profile;
    }),
  );
  const discoveryRequirements: string[] = [];
  if (user.role === "pro") {
    const own = profiles.find((p) => p.id === user.id);
    if (!own) discoveryRequirements.push("Create your business profile.");
    else {
      if (!own.verified)
        discoveryRequirements.push(
          "Complete professional identity verification.",
        );
      if (own.reviewStatus !== "approved")
        discoveryRequirements.push(
          "Your business profile needs administrator approval.",
        );
      if (own.suspended)
        discoveryRequirements.push(
          "Contact support about your suspended business profile.",
        );
      if (!own.available)
        discoveryRequirements.push(
          "Turn on availability in your business profile.",
        );
    }
    if (
      !(
        await pool.query(
          "SELECT 1 FROM professional_subscriptions WHERE user_id=$1 AND status IN ('active','trialing')",
          [user.id],
        )
      ).rowCount
    )
      discoveryRequirements.push("Activate your professional subscription.");
  }
  const leads =
    user.role === "pro"
      ? (
          await pool.query(
            `SELECT p.id,p.version,p.title,p.description,p.intake,p.category,p.zip,p.urgency,p.property_type,p.budget_min,p.budget_max,p.status,p.created_at,p.scheduled_at,NULL AS customer_id,NULL AS pro_id,NULL AS amount FROM projects p ${preview ? "JOIN users f ON f.id=$1 LEFT JOIN profiles own ON own.id=f.id" : "JOIN profiles f ON f.id=$1"} WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted') AND ${unblockedSql()} AND (${preview ? "(own.id IS NULL OR NOT own.suspended)" : `${discoverySql()} OR EXISTS(SELECT 1 FROM quotes own_quote WHERE own_quote.project_id=p.id AND own_quote.pro_id=$1 AND own_quote.status='pending')`}) ORDER BY p.created_at DESC,p.id ${preview ? "" : "LIMIT 100"}`,
            [user.id],
          )
        ).rows.map((r) => camel<Project>(r))
      : [];
  const allIds = [...ids, ...leads.map((p) => p.id)];
  const [
    quotes,
    messages,
    payments,
    reviews,
    tickets,
    notices,
    uploads,
    saved,
    blocked,
  ] = await Promise.all([
    pool.query(
      admin
        ? "SELECT * FROM quotes ORDER BY created_at DESC LIMIT 1000"
        : "SELECT q.*,(SELECT title FROM projects WHERE id=q.project_id) AS project_title FROM quotes q WHERE q.pro_id=$2 OR (q.project_id=ANY($1::uuid[]) AND q.project_id IN (SELECT id FROM projects WHERE customer_id=$2)) ORDER BY q.created_at DESC",
      admin ? [] : [allIds, user.id],
    ),
    pool.query(
      "SELECT * FROM messages WHERE project_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 1000",
      [admin ? [] : ids],
    ),
    pool.query(
      "SELECT * FROM payments WHERE project_id=ANY($1::uuid[]) ORDER BY created_at DESC",
      [ids],
    ),
    pool.query(
      "SELECT * FROM reviews WHERE project_id=ANY($1::uuid[]) ORDER BY created_at DESC",
      [ids],
    ),
    pool.query(
      admin
        ? "SELECT * FROM tickets ORDER BY created_at DESC LIMIT 500"
        : "SELECT * FROM tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500",
      params,
    ),
    pool.query(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [user.id],
    ),
    pool.query(
      "SELECT id,project_id,name,content_type,size,status FROM uploads WHERE (project_id=ANY($1::uuid[]) AND (status='ready' OR user_id=$2)) OR (project_id=ANY($3::uuid[]) AND status='ready' AND content_type LIKE 'image/%') ORDER BY created_at",
      [admin ? [] : ids, user.id, leads.map((lead) => lead.id)],
    ),
    pool.query("SELECT pro_id FROM saved WHERE user_id=$1", [user.id]),
    pool.query("SELECT other_id FROM blocked WHERE user_id=$1", [user.id]),
  ]);
  return {
    user,
    discoveryMode: preview ? "open" : env.MARKETPLACE_DISCOVERY_MODE,
    marketplacePreview: preview,
    discoveryRequirements,
    profiles,
    projects,
    leads,
    quotes: quotes.rows.map((r) => camel(r)),
    messages: messages.rows.reverse().map((r) => camel(r)),
    payments: payments.rows.map((r) => camel(r)),
    reviews: reviews.rows.map((r) => camel(r)),
    tickets: tickets.rows.map((r) => camel(r)),
    notices: notices.rows.map((r) => camel(r)),
    unreadCount: (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND NOT read",
        [user.id],
      )
    ).rows[0].n,
    uploads: uploads.rows.map((r) => camel(r)),
    saved: saved.rows.map((r) => r.pro_id),
    blocked: blocked.rows.map((r) => r.other_id),
  } as Workspace;
}
export async function notify(
  c: pg.PoolClient,
  userId: string | null,
  title: string,
  body: string,
  target: { page: string; id?: string } = { page: "notifications" },
) {
  if (!userId) return;
  await c.query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), userId, title, body, target.page, target.id || null],
  );
  await c.query(
    "INSERT INTO email_outbox(id,user_id,subject,body) SELECT $1,id,$3,$4 FROM users WHERE id=$2 AND COALESCE((settings->>'emailAlerts')::boolean,true)",
    [randomUUID(), userId, title, body],
  );
}
// One bulk insert for fan-out alerts: a notification per user plus an email for those who allow email alerts.
export async function notifyMany(
  c: pg.PoolClient,
  userIds: string[],
  title: string,
  body: string,
  target: { page: string; id?: string } = { page: "notifications" },
) {
  if (!userIds.length) return;
  await c.query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) SELECT gen_random_uuid(),u,$2,$3,$4,$5 FROM unnest($1::text[]) AS u",
    [userIds, title, body, target.page, target.id || null],
  );
  await c.query(
    "INSERT INTO email_outbox(id,user_id,subject,body) SELECT gen_random_uuid(),id,$2,$3 FROM users WHERE id=ANY($1::text[]) AND COALESCE((settings->>'emailAlerts')::boolean,true)",
    [userIds, title, body],
  );
}
export async function audit(
  c: pg.PoolClient,
  userId: string,
  action: string,
  entityId: string,
) {
  await c.query(
    "INSERT INTO audit_log(id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)",
    [randomUUID(), userId, action, entityId],
  );
}
export async function getProject(c: pg.PoolClient, id: string) {
  const p = (
    await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id])
  ).rows[0];
  if (!p) fail(404, "Project not found.");
  return camel<Project>(p);
}

export async function notifyAdministrators(
  c: pg.PoolClient,
  title: string,
  body: string,
) {
  const users = (await c.query("SELECT id FROM users WHERE role='admin'")).rows;
  for (const user of users)
    await notify(c, user.id, title, body, { page: "reports" });
}
