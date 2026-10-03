import { randomUUID } from "node:crypto";
import { pool, camel } from "./db/index.js";
import type pg from "pg";
import type { User, Workspace, Profile, Project } from "../shared/domain.js";
import { fail } from "./errors.js";
export const profileSelect = `SELECT p.id,u.name,p.business,p.category,p.bio,p.zip,p.rate,p.available,p.availability,p.verified,p.suspended,p.connect_ready,
 COALESCE((SELECT avg(r.rating)::float FROM reviews r WHERE r.pro_id=p.id),0) AS rating,
 (SELECT count(*)::int FROM reviews r WHERE r.pro_id=p.id) AS review_count FROM profiles p JOIN users u ON u.id=p.id`;
export async function publicProfiles(id?: string) {
  const { rows } = await pool.query(
    profileSelect +
      " WHERE p.verified=true AND p.suspended=false" +
      (id ? " AND p.id=$1" : " ORDER BY p.business LIMIT 200"),
    id ? [id] : [],
  );
  return rows.map((r) => camel<Profile>(r));
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
  const profiles = (
    await pool.query(
      profileSelect +
        (admin ? "" : " WHERE (p.verified AND NOT p.suspended) OR p.id=$1") +
        " ORDER BY p.business LIMIT 500",
      params,
    )
  ).rows.map((r) => camel<Profile>(r));
  const leads =
    user.role === "pro"
      ? (
          await pool.query(
            "SELECT p.id,p.title,p.description,p.intake,p.category,p.zip,p.status,p.created_at,p.scheduled_at,NULL AS customer_id,NULL AS pro_id,NULL AS amount FROM projects p JOIN profiles f ON f.id=$1 AND f.category=p.category AND f.verified AND NOT f.suspended AND f.available WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted') ORDER BY p.created_at DESC LIMIT 100",
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
      "SELECT id,project_id,name,content_type,size,status FROM uploads WHERE project_id=ANY($1::uuid[]) AND status='ready' ORDER BY created_at",
      [admin ? [] : ids],
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
) {
  if (!userId) return;
  await c.query(
    "INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), userId, title, body],
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
