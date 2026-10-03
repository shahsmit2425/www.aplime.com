import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "./db/index.js";
import { getProject, notify } from "./repository.js";
import { fail } from "./errors.js";
import { meeting } from "./integrations/daily.js";
export const discussions = Router();
export function canReadDiscussion(
  row: { customer_id: string; pro_id: string },
  userId: string,
) {
  return row.customer_id === userId || row.pro_id === userId;
}
async function participant(id: string, userId: string) {
  const row = (
    await pool.query(
      "SELECT d.*,p.customer_id,p.status,p.pro_id AS selected_pro FROM project_discussions d JOIN projects p ON p.id=d.project_id WHERE d.id=$1",
      [z.string().uuid().parse(id)],
    )
  ).rows[0];
  if (!row || !canReadDiscussion(row, userId))
    fail(404, "Conversation unavailable.");
  const other = row.customer_id === userId ? row.pro_id : row.customer_id;
  return { row, other };
}
async function maySend(row: any, userId: string, other: string) {
  if (
    ["cancelled", "disputed"].includes(row.status) ||
    (row.selected_pro && row.selected_pro !== row.pro_id)
  )
    fail(
      409,
      "This discussion is closed. Your existing messages are still available.",
    );
  if (
    (
      await pool.query(
        "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
        [userId, other],
      )
    ).rowCount
  )
    fail(403, "This conversation is blocked.");
}
discussions.get("/discussions", async (req, res) => {
  const result = await pool.query(
    `SELECT d.*,p.title,p.customer_id,p.status,p.pro_id AS selected_pro,f.business,c.name AS customer_name,
    COALESCE((SELECT json_agg(m ORDER BY m.created_at) FROM (SELECT id,sender_id,body,created_at FROM discussion_messages WHERE discussion_id=d.id ORDER BY created_at DESC LIMIT 200) m),'[]'::json) AS messages
    FROM project_discussions d JOIN projects p ON p.id=d.project_id JOIN profiles f ON f.id=d.pro_id JOIN users c ON c.id=p.customer_id
    WHERE p.customer_id=$1 OR d.pro_id=$1 ORDER BY d.created_at DESC LIMIT 100`,
    [req.account.id],
  );
  res.json(result.rows);
});
discussions.post("/projects/:id/discussions", async (req, res) => {
  const { body } = z
    .object({ body: z.string().trim().min(10).max(4000) })
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
    const eligible = await c.query(
      "SELECT 1 FROM profiles f JOIN professional_subscriptions s ON s.user_id=f.id WHERE f.id=$1 AND f.verified AND f.review_status='approved' AND NOT f.suspended AND f.available AND s.status IN ('active','trialing')",
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
    const d = (
      await c.query(
        "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3) ON CONFLICT(project_id,pro_id) DO UPDATE SET pro_id=EXCLUDED.pro_id RETURNING id",
        [randomUUID(), p.id, req.account.id],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO discussion_messages(id,discussion_id,sender_id,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), d.id, req.account.id, body],
    );
    await notify(
      c,
      p.customerId,
      "A professional has a question",
      "Open " + p.title + " to discuss the work before choosing an estimate.",
      { page: "messages", id: d.id },
    );
    return d;
  });
  res.json(result);
});
discussions.post("/discussions/:id/messages", async (req, res) => {
  const { body } = z
    .object({ body: z.string().trim().min(1).max(4000) })
    .strict()
    .parse(req.body);
  const { row, other } = await participant(
    String(req.params.id),
    req.account.id,
  );
  await maySend(row, req.account.id, other);
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO discussion_messages(id,discussion_id,sender_id,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), row.id, req.account.id, body],
    );
    await notify(
      c,
      other,
      "New project discussion message",
      "Open your project discussions to reply.",
      { page: "messages", id: row.id },
    );
  });
  res.json({ ok: true });
});
discussions.post("/discussions/:id/call", async (req, res) => {
  const { audioOnly } = z
    .object({ audioOnly: z.boolean() })
    .strict()
    .parse(req.body);
  const { row, other } = await participant(
    String(req.params.id),
    req.account.id,
  );
  await maySend(row, req.account.id, other);
  const room = await meeting(
    row.id,
    req.account.id,
    req.account.name,
    audioOnly,
  );
  await transaction((c) =>
    notify(
      c,
      other,
      audioOnly
        ? "Incoming audio call invitation"
        : "Incoming video call invitation",
      "Open the private project chat and select the matching call button to join.",
      { page: "messages", id: row.id },
    ),
  );
  res.json(room);
});
