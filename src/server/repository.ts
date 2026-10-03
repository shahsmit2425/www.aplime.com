import { env } from "./config.js";
import { imageUrl } from "./integrations/storage.js";
import { randomUUID } from "node:crypto";
import { pool, camel } from "./db/index.js";
import type pg from "pg";
import type { User, Workspace, Profile, Project } from "../shared/domain.js";
import { fail } from "./errors.js";
export const profileSelect = `SELECT p.id,u.name,p.business,p.details,p.category,p.bio,p.zip,p.rate,p.available,p.availability,p.verified,p.suspended,p.connect_ready,
 COALESCE((SELECT json_agg(json_build_object('id',i.id,'slot',i.slot,'key',i.object_key) ORDER BY i.slot) FROM business_images i WHERE i.profile_id=p.id AND i.status='ready'),'[]'::json) AS images,
 COALESCE((SELECT avg(r.rating)::float FROM reviews r WHERE r.pro_id=p.id),0) AS rating,
 (SELECT count(*)::int FROM reviews r WHERE r.pro_id=p.id) AS review_count FROM profiles p JOIN users u ON u.id=p.id`;
async function mappedProfile(row: Record<string, any>, ownerId?: string) {
  const profile = camel<Profile>(row);
  profile.images = await Promise.all(
    (row.images || []).map(async (i: any) => ({
      id: i.id,
      slot: i.slot,
      url:
        profile.id === ownerId
          ? await imageUrl(i.key)
          : env.API_URL.replace(/\/$/, "") + "/api/business-images/" + i.id,
    })),
  );
  return profile;
}
export async function publicProfiles(id?: string) {
  const { rows } = await pool.query(
    profileSelect +
      " WHERE p.verified=true AND p.suspended=false AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=p.id AND s.status IN ('active','trialing'))" +
      (id ? " AND p.id=$1" : " ORDER BY p.business LIMIT 200"),
    id ? [id] : [],
  );
  return Promise.all(rows.map((r) => mappedProfile(r)));
}
export async function workspace(user: User): Promise<Workspace> {
  const admin = user.role === "admin",
    params = admin ? [] : [user.id];
  const projectWhere = admin ? "" : " WHERE p.customer_id=$1 OR p.pro_id=$1";
  const projects = (
    await pool.query(
      "SELECT p.*,c.name AS customer_name,u.name AS pro_name FROM projects p JOIN users c ON c.id=p.customer_id LEFT JOIN users u ON u.id=p.pro_id" +
        projectWhere +
        " ORDER BY p.created_at DESC LIMIT 500",
      params,
    )
  ).rows.map((r) => camel<Project>(r));
  const ids = projects.map((p) => p.id);
  const profileRows = (
    await pool.query(
      profileSelect +
        (admin
          ? ""
          : " WHERE (p.verified AND NOT p.suspended AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=p.id AND s.status IN ('active','trialing'))) OR p.id=$1") +
        " ORDER BY p.business LIMIT 500",
      params,
    )
  ).rows;
  const profiles = await Promise.all(
    profileRows.map((r) => mappedProfile(r, user.id)),
  );
  const leads =
    user.role === "pro"
      ? (
          await pool.query(
            "SELECT p.id,p.title,p.description,p.intake,p.category,p.zip,p.status,p.created_at,p.scheduled_at,NULL AS customer_id,NULL AS pro_id,NULL AS amount FROM projects p JOIN profiles f ON f.id=$1 AND f.category=p.category AND f.verified AND NOT f.suspended AND f.available AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=f.id AND s.status IN ('active','trialing')) WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted') ORDER BY p.created_at DESC LIMIT 100",
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
        : "SELECT * FROM quotes WHERE project_id=ANY($1::uuid[]) AND (pro_id=$2 OR project_id IN (SELECT id FROM projects WHERE customer_id=$2)) ORDER BY created_at DESC",
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
      "SELECT id,project_id,name,content_type,size,status FROM uploads WHERE project_id=ANY($1::uuid[]) AND (status='ready' OR user_id=$2) ORDER BY created_at",
      [admin ? [] : ids, user.id],
    ),
    pool.query("SELECT pro_id FROM saved WHERE user_id=$1", [user.id]),
    pool.query("SELECT other_id FROM blocked WHERE user_id=$1", [user.id]),
  ]);
  return {
    user,
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
