import type pg from "pg";
import { randomUUID } from "node:crypto";
import type { Project } from "../shared/domain.js";
import { matchSql, rankSql } from "./matching.js";
import { notifyMany } from "./repository.js";
import { pool } from "./db/index.js";
import { fail } from "./errors.js";

export async function readProjectActivity(projectId: string, userId: string) {
  const p = (
    await pool.query("SELECT customer_id,pro_id FROM projects WHERE id=$1", [
      projectId,
    ])
  ).rows[0];
  if (!p || (userId !== p.customer_id && userId !== p.pro_id))
    fail(403, "This project is private.");
  return (
    await pool.query(
      "SELECT a.id,a.action,a.summary,a.reason,a.created_at,u.name AS actor_name FROM project_activity a JOIN users u ON u.id=a.actor_id WHERE a.project_id=$1 AND ($2::boolean OR a.actor_id=$3 OR a.actor_id=$4 OR u.role='admin') ORDER BY a.created_at DESC,a.id LIMIT 100",
      [projectId, userId === p.customer_id, userId, p.customer_id],
    )
  ).rows;
}

export async function recordProjectActivity(
  c: pg.PoolClient,
  projectId: string,
  actorId: string,
  action: string,
  summary: string,
  reason?: string,
) {
  await c.query(
    "INSERT INTO project_activity(id,project_id,actor_id,action,summary,reason) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), projectId, actorId, action, summary, reason || null],
  );
}

// The best-ranked eligible professionals are alerted (capped so one request cannot flood the outbox).
export const ALERT_LIMIT = 50;
export async function notifyMatchingProfessionals(
  c: pg.PoolClient,
  projectId: string,
  title = "New service opportunity",
) {
  const matches = (
    await c.query(
      `SELECT f.id,p.category,p.zip FROM profiles f JOIN projects p ON p.id=$1 WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted') AND ${matchSql()}
       AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.project_id=p.id AND q.pro_id=f.id)
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=f.id AND n.target_page='project' AND n.target_id=p.id::text AND n.title=$2 AND n.created_at>now()-interval '12 hours')
       ORDER BY ${rankSql()} LIMIT ${ALERT_LIMIT}`,
      [projectId, title],
    )
  ).rows;
  if (matches.length)
    await notifyMany(
      c,
      matches.map((row) => row.id as string),
      title,
      `${matches[0].category} request in ZIP ${matches[0].zip}. Review the project before responding.`,
      { page: "project", id: projectId },
    );
  return matches.map((row) => row.id as string);
}

export async function notifyProjectMembers(
  c: pg.PoolClient,
  p: Project,
  title: string,
  body: string,
  extraIds: string[] = [],
) {
  await notifyMany(
    c,
    [
      ...new Set(
        [p.customerId, p.proId, ...extraIds].filter(Boolean) as string[],
      ),
    ],
    title,
    body,
    { page: "project", id: p.id },
  );
}

// Close stale opportunities and notify interested pros without exposing participant-only reasons.
export async function notifyProjectObservers(
  c: pg.PoolClient,
  p: Project,
  title: string,
  body = "A project you received has changed. Check your matched projects and conversations.",
) {
  const observers = (
    await c.query(
      `SELECT DISTINCT user_id FROM (
    SELECT pro_id AS user_id FROM project_discussions WHERE project_id=$1
    UNION SELECT pro_id FROM quotes WHERE project_id=$1
    UNION SELECT user_id FROM notifications WHERE target_page='project' AND target_id=$1::text
  ) viewers WHERE user_id<>$2 AND ($3::text IS NULL OR user_id<>$3)`,
      [p.id, p.customerId, p.proId],
    )
  ).rows;
  await notifyMany(
    c,
    observers.map((row) => row.user_id as string),
    title,
    body,
    { page: "leads" },
  );
}
