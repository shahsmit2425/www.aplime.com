import type pg from "pg";
import { randomUUID } from "node:crypto";
import type { Project } from "../shared/domain.js";
import { matchSql } from "./matching.js";
import { notify } from "./repository.js";
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

// Every eligible professional is alerted, independently of the five-card customer shortlist.
export async function notifyMatchingProfessionals(
  c: pg.PoolClient,
  projectId: string,
  title = "New service opportunity",
) {
  const matches = (
    await c.query(
      `SELECT f.id,p.category,p.zip FROM profiles f JOIN projects p ON p.id=$1 WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted') AND ${matchSql()}`,
      [projectId],
    )
  ).rows;
  for (const row of matches)
    await notify(
      c,
      row.id,
      title,
      `${row.category} request in ZIP ${row.zip}. Review the project before responding.`,
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
  for (const id of new Set(
    [p.customerId, p.proId, ...extraIds].filter(Boolean) as string[],
  ))
    await notify(c, id, title, body, { page: "project", id: p.id });
}

// Close stale opportunities and notify interested pros without exposing participant-only reasons.
export async function notifyProjectObservers(
  c: pg.PoolClient,
  p: Project,
  title: string,
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
  for (const row of observers)
    await notify(
      c,
      row.user_id,
      title,
      "A project you received has changed. Check your matched projects and conversations.",
      { page: "leads" },
    );
}
