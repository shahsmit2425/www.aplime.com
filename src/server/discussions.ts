import { assertMatch } from "./matching.js";
import { assertMessageQuota, lockActiveAccount } from "./quotas.js";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction, camel } from "./db/index.js";
import { getProject, notify } from "./repository.js";
import { fail } from "./errors.js";
import type pg from "pg";
export const discussions = Router();
export function canReadDiscussion(
  row: { customer_id: string; pro_id: string },
  userId: string,
) {
  return row.customer_id === userId || row.pro_id === userId;
}
export async function ensurePairConversation(
  c: pg.PoolClient,
  projectId: string,
  customerId: string,
  proId: string,
) {
  await c.query(
    "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3) ON CONFLICT(project_id,pro_id) DO NOTHING",
    [randomUUID(), projectId, proId],
  );
  const links = (
    await c.query(
      "SELECT d.id,d.project_id FROM project_discussions d JOIN projects p ON p.id=d.project_id WHERE p.customer_id=$1 AND d.pro_id=$2 ORDER BY d.created_at,d.id",
      [customerId, proId],
    )
  ).rows;
  return {
    id: links[0].id as string,
    contextId: links.find((d) => d.project_id === projectId).id as string,
  };
}
// Project discussion rows are context links. The oldest link is the stable
// conversation ID for a customer/business pair; legacy IDs remain valid aliases.
async function participant(id: string, userId: string, projectId?: string) {
  const requested = (
    await pool.query(
      "SELECT d.*,p.customer_id FROM project_discussions d JOIN projects p ON p.id=d.project_id WHERE d.id=$1",
      [z.string().uuid().parse(id)],
    )
  ).rows[0];
  if (!requested || !canReadDiscussion(requested, userId))
    fail(404, "Conversation unavailable.");
  const links = (
    await pool.query(
      "SELECT d.*,p.customer_id,p.status,p.pro_id AS selected_pro FROM project_discussions d JOIN projects p ON p.id=d.project_id WHERE p.customer_id=$1 AND d.pro_id=$2 ORDER BY d.created_at,d.id",
      [requested.customer_id, requested.pro_id],
    )
  ).rows;
  const row = projectId
    ? links.find((d) => d.project_id === projectId)
    : links.at(-1);
  if (!row) fail(404, "Project unavailable in this conversation.");
  return {
    row,
    links,
    canonicalId: links[0].id,
    other:
      requested.customer_id === userId
        ? requested.pro_id
        : requested.customer_id,
  };
}
async function maySend(row: any, userId: string, other: string) {
  if (
    (
      await pool.query(
        "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
        [userId, other],
      )
    ).rowCount
  )
    fail(403, "This conversation is blocked.");
  if (
    (
      await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND suspended", [
        row.pro_id,
      ])
    ).rowCount
  )
    fail(403, "This business cannot receive or send messages right now.");
}
export const conversationListSql = `WITH pairs AS (
  SELECT p.customer_id,d.pro_id,(array_agg(d.id ORDER BY d.created_at,d.id))[1] AS id,
    array_agg(d.id ORDER BY d.created_at,d.id) AS aliases,
    (array_agg(p.id ORDER BY d.created_at DESC,d.id DESC))[1] AS project_id,
    json_agg(json_build_object('id',p.id,'discussion_id',d.id,'title',p.title,'status',p.status,'selected_pro',p.pro_id) ORDER BY d.created_at DESC,d.id DESC) AS projects,
    max(d.created_at) AS created_at
  FROM project_discussions d JOIN projects p ON p.id=d.project_id
  WHERE p.customer_id=$1 OR d.pro_id=$1 GROUP BY p.customer_id,d.pro_id
) SELECT t.*,p.title,p.status,p.pro_id AS selected_pro,f.business,c.name AS customer_name,
  (f.suspended OR EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=t.customer_id AND b.other_id=t.pro_id) OR (b.user_id=t.pro_id AND b.other_id=t.customer_id))) AS read_only,
  (SELECT count(*)::int FROM notifications n WHERE n.user_id=$1 AND NOT n.read AND n.target_page='messages' AND n.target_id=ANY(t.aliases::text[])) AS unread_count,
  COALESCE((SELECT json_agg(n.id) FROM (SELECT n.id FROM notifications n WHERE n.user_id=$1 AND NOT n.read AND n.target_page='messages' AND n.target_id=ANY(t.aliases::text[]) ORDER BY n.created_at,n.id LIMIT 1000) n),'[]'::json) AS unread_notice_ids,
  COALESCE((SELECT json_agg(m ORDER BY m.created_at,m.id) FROM (
    SELECT m.id,m.sender_id,m.body,m.created_at,d.project_id FROM discussion_messages m JOIN project_discussions d ON d.id=m.discussion_id
    WHERE m.discussion_id=ANY(t.aliases) ORDER BY m.created_at DESC,m.id DESC LIMIT 200
  ) m),'[]'::json) AS messages
  FROM pairs t JOIN projects p ON p.id=t.project_id JOIN profiles f ON f.id=t.pro_id JOIN users c ON c.id=t.customer_id
  ORDER BY COALESCE((SELECT max(m.created_at) FROM discussion_messages m WHERE m.discussion_id=ANY(t.aliases)),t.created_at) DESC,t.id LIMIT 100`;
discussions.get("/discussions", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const sql =
    req.query.preview === "true"
      ? conversationListSql.replace("LIMIT 200", "LIMIT 1")
      : conversationListSql;
  res.json((await pool.query(sql, [req.account.id])).rows);
});
discussions.get("/discussions/:id/history", async (req, res) => {
  const { links } = await participant(String(req.params.id), req.account.id);
  const before = z
    .object({ at: z.string().datetime(), id: z.string().uuid() })
    .optional()
    .parse(
      req.query.beforeAt
        ? { at: req.query.beforeAt, id: req.query.beforeId }
        : undefined,
    );
  const result = await pool.query(
    "SELECT m.id,m.sender_id,m.body,m.created_at,d.project_id FROM discussion_messages m JOIN project_discussions d ON d.id=m.discussion_id WHERE m.discussion_id=ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR (m.created_at,m.id)<($2::timestamptz,$3::uuid)) ORDER BY m.created_at DESC,m.id DESC LIMIT 51",
    [links.map((d) => d.id), before?.at || null, before?.id || null],
  );
  res.json({
    messages: result.rows.slice(0, 50).reverse(),
    hasMore: result.rows.length > 50,
  });
});

discussions.get("/discussions/:id/projects/:projectId", async (req, res) => {
  const { row } = await participant(
    String(req.params.id),
    req.account.id,
    z.string().uuid().parse(req.params.projectId),
  );
  if (req.account.role === "pro") {
    const other = row.customer_id;
    await maySend(row, req.account.id, other);
    if (row.selected_pro && row.selected_pro !== req.account.id)
      fail(
        403,
        "Project details are no longer available to this professional.",
      );
  }
  const p = (
    await pool.query(
      "SELECT p.id,p.title,p.description,p.category,p.zip,p.intake,p.property_type,p.urgency,p.status,p.budget_min,p.budget_max,p.amount,p.created_at,p.scheduled_at,p.customer_id,p.pro_id,c.name AS customer_name,CASE WHEN p.customer_id=$2 OR p.pro_id=$2 THEN p.address ELSE NULL END AS address,CASE WHEN p.customer_id=$2 OR p.pro_id=$2 THEN p.address_unit ELSE NULL END AS address_unit FROM projects p JOIN users c ON c.id=p.customer_id WHERE p.id=$1",
      [row.project_id, req.account.id],
    )
  ).rows[0];
  const files = (
    await pool.query(
      "SELECT id,project_id,name,content_type,size,status FROM uploads WHERE project_id=$1 AND status='ready' AND content_type LIKE 'image/%' ORDER BY created_at",
      [row.project_id],
    )
  ).rows;
  res.setHeader("Cache-Control", "no-store");
  res.json({ project: camel(p), files: files.map((f) => camel(f)) });
});
discussions.post("/projects/:id/discussions/:proId", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const result = await transaction(async (c) => {
    const p = await getProject(c, z.string().uuid().parse(req.params.id));
    const proId = z.string().min(1).max(128).parse(req.params.proId);
    if (p.customerId !== req.account.id) fail(404, "Project unavailable.");
    if (
      !["requested", "quoted"].includes(p.status) ||
      (p.proId && p.proId !== proId)
    )
      fail(409, "This request is no longer open.");
    await assertMatch(c, proId, p.id);
    const created = await c.query(
      "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3) ON CONFLICT(project_id,pro_id) DO NOTHING RETURNING id",
      [randomUUID(), p.id, proId],
    );
    const thread =
      created.rows[0] ||
      (
        await c.query(
          "SELECT id FROM project_discussions WHERE project_id=$1 AND pro_id=$2",
          [p.id, proId],
        )
      ).rows[0];
    if (created.rowCount)
      await notify(
        c,
        proId,
        "Customer started a private chat",
        p.title + ": open the conversation to reply.",
        { page: "messages", id: thread.id },
      );
    return thread;
  });
  res.json(result);
});

discussions.post("/projects/:id/discussions", async (req, res) => {
  const { body } = z
    .object({ body: z.string().trim().min(1).max(4000).optional() })
    .strict()
    .parse(req.body);
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  const result = await transaction(async (c) => {
    const p = await getProject(c, z.string().uuid().parse(req.params.id));
    if (
      !["requested", "quoted"].includes(p.status) ||
      (p.proId && p.proId !== req.account.id)
    )
      fail(409, "This project is no longer accepting responses.");
    await assertMatch(c, req.account.id, p.id);
    const eligible = await c.query(
      "SELECT 1 FROM profiles f JOIN professional_subscriptions s ON s.user_id=f.id WHERE f.id=$1 AND f.verified AND (f.review_status='approved' OR f.listed) AND NOT f.suspended AND f.available AND s.status IN ('active','trialing')",
      [req.account.id],
    );
    if (!eligible.rowCount)
      fail(
        403,
        "An approved, available business with an active subscription is required.",
      );
    if (
      (
        await c.query(
          "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
          [req.account.id, p.customerId],
        )
      ).rowCount
    )
      fail(403, "This conversation is blocked.");
    const created = await c.query(
      "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3) ON CONFLICT(project_id,pro_id) DO NOTHING RETURNING id",
      [randomUUID(), p.id, req.account.id],
    );
    const d =
      created.rows[0] ||
      (
        await c.query(
          "SELECT id FROM project_discussions WHERE project_id=$1 AND pro_id=$2",
          [p.id, req.account.id],
        )
      ).rows[0];
    if (body) {
      await assertMessageQuota(c, req.account.id);
      await c.query(
        "INSERT INTO discussion_messages(id,discussion_id,sender_id,body) VALUES($1,$2,$3,$4)",
        [randomUUID(), d.id, req.account.id, body],
      );
    }
    if (created.rowCount || body)
      await notify(
        c,
        p.customerId,
        "A professional started a conversation",
        "Open " + p.title + " to discuss the work before choosing an estimate.",
        { page: "messages", id: d.id },
      );
    return d;
  });
  res.json(result);
});
discussions.post("/discussions/:id/read", async (req, res) => {
  const { links } = await participant(String(req.params.id), req.account.id);
  const { noticeIds } = z
    .object({ noticeIds: z.array(z.string().uuid()).max(1000) })
    .strict()
    .parse(req.body);
  await pool.query(
    "UPDATE notifications SET read=true WHERE user_id=$1 AND NOT read AND target_page='messages' AND target_id=ANY($2::text[]) AND id=ANY($3::uuid[])",
    [req.account.id, links.map((d) => d.id), noticeIds],
  );
  res.json({ ok: true });
});

discussions.post("/discussions/:id/messages", async (req, res) => {
  const { body, projectId, clientKey } = z
    .object({
      body: z.string().trim().min(1).max(4000),
      projectId: z.string().uuid().optional(),
      clientKey: z.string().uuid().optional(),
    })
    .strict()
    .parse(req.body);
  const { row, other, canonicalId } = await participant(
    String(req.params.id),
    req.account.id,
    projectId,
  );
  await maySend(row, req.account.id, other);
  await transaction(async (c) => {
    await lockActiveAccount(c, req.account.id);
    if (clientKey) {
      const previous = (
        await c.query(
          "SELECT body FROM discussion_messages WHERE discussion_id=$1 AND sender_id=$2 AND client_key=$3",
          [row.id, req.account.id, clientKey],
        )
      ).rows[0];
      if (previous) {
        if (previous.body !== body)
          fail(409, "This message was already sent with different content.");
        return;
      }
    }
    await assertMessageQuota(c, req.account.id);
    await c.query(
      "INSERT INTO discussion_messages(id,discussion_id,sender_id,body,client_key) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), row.id, req.account.id, body, clientKey || null],
    );
    await notify(c, other, "New message", "Open Messages to reply.", {
      page: "messages",
      id: canonicalId,
    });
  });
  res.json({ ok: true });
});
discussions.post("/discussions/:id/call", (_req, _res) => {
  fail(
    410,
    "Direct calls are no longer available. Schedule and confirm a meeting to call.",
  );
});
