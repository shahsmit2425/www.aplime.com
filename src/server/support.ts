import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, camel, transaction } from "./db/index.js";
import { audit, notify, notifyAdministrators } from "./repository.js";
import { fail } from "./errors.js";
export const supportPage = z.coerce
  .number()
  .int()
  .min(1)
  .max(100000)
  .default(1);
const ticketSelect = `SELECT t.*,u.name AS user_name,u.email AS user_email,COALESCE(op.name,u.name) AS opened_by_name,
 (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id=t.id) AS message_count,
 GREATEST(t.created_at,COALESCE((SELECT max(created_at) FROM support_messages m WHERE m.ticket_id=t.id),t.created_at)) AS updated_at
 FROM tickets t JOIN users u ON u.id=t.user_id LEFT JOIN users op ON op.id=t.opened_by`;
export function supportRouter(admin: boolean) {
  const router = Router();
  // This scope is chosen only by the API mount, never by a query/body role.
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      admin
        ? req.account.role !== "admin"
        : !["customer", "pro"].includes(req.account.role)
    )
      fail(403, "Support access is not authorized.");
    next();
  });
  router.get("/conversations", async (req, res) => {
    const page = supportPage.parse(req.query.page);
    const params = admin ? [] : [req.account.id];
    const where = admin ? "" : " WHERE t.user_id=$1";
    const total = (
      await pool.query(
        "SELECT count(*)::int AS n FROM tickets t" + where,
        params,
      )
    ).rows[0].n;
    const rows = (
      await pool.query(
        ticketSelect +
          where +
          ` ORDER BY updated_at DESC,t.id LIMIT 25 OFFSET $${params.length + 1}`,
        [...params, (page - 1) * 25],
      )
    ).rows.map((r) => camel(r));
    res.json({ rows, total, page, pageSize: 25 });
  });
  router.post("/conversations", async (req, res) => {
    const input = z
      .object({
        subject: z.string().trim().min(5).max(120),
        body: z.string().trim().min(10).max(4000),
        ...(admin ? { userId: z.string().min(1).max(128) } : {}),
      })
      .strict()
      .parse(req.body);
    const userId = admin
      ? String((input as { userId: string }).userId)
      : req.account.id;
    const id = randomUUID();
    await transaction(async (c) => {
      const target = (
        await c.query("SELECT role FROM users WHERE id=$1", [userId])
      ).rows[0];
      if (!target || !["customer", "pro"].includes(target.role))
        fail(404, "Marketplace user not found.");
      await c.query(
        "INSERT INTO tickets(id,user_id,subject,body,opened_by) VALUES($1,$2,$3,$4,$5)",
        [id, userId, input.subject, input.body, req.account.id],
      );
      await audit(c, req.account.id, "support_open", id);
      if (admin)
        await notify(
          c,
          userId,
          "Aplime support contacted you",
          "Open your support conversation to read and reply.",
          { page: "help", id },
        );
      else
        await notifyAdministrators(
          c,
          "New support conversation",
          "A user contacted Aplime support.",
          { page: "support", id },
        );
    });
    res.status(201).json({ id });
  });
  router.get("/conversations/:id", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      page = supportPage.parse(req.query.page);
    const ticket = (
      await pool.query(
        ticketSelect + " WHERE t.id=$1" + (admin ? "" : " AND t.user_id=$2"),
        admin ? [id] : [id, req.account.id],
      )
    ).rows[0];
    if (!ticket) fail(404, "Support conversation not found.");
    const messages = (
      await pool.query(
        "SELECT m.id,m.body,m.sender_id,m.created_at,u.name AS sender_name,u.role AS sender_role FROM support_messages m JOIN users u ON u.id=m.sender_id WHERE m.ticket_id=$1 ORDER BY m.created_at DESC,m.id DESC LIMIT 50 OFFSET $2",
        [id, (page - 1) * 50],
      )
    ).rows
      .reverse()
      .map((r) => camel(r));
    if (admin)
      await transaction((c) =>
        audit(c, req.account.id, "admin_support_read", id),
      );
    res.json({
      ticket: camel(ticket),
      messages,
      total: ticket.message_count,
      page,
    });
  });
  router.post("/conversations/:id/messages", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = z
      .object({
        body: z.string().trim().min(1).max(4000),
        clientKey: z.string().uuid(),
      })
      .strict()
      .parse(req.body);
    await transaction(async (c) => {
      const ticket = (
        await c.query("SELECT * FROM tickets WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!ticket || (!admin && ticket.user_id !== req.account.id))
        fail(404, "Support conversation not found.");
      const duplicate = (
        await c.query(
          "SELECT id,body FROM support_messages WHERE ticket_id=$1 AND sender_id=$2 AND client_key=$3",
          [id, req.account.id, input.clientKey],
        )
      ).rows[0];
      if (duplicate) {
        if (duplicate.body !== input.body)
          fail(
            409,
            "The previous message was already sent. Refresh the conversation before sending a changed message.",
          );
        return;
      }
      if (ticket.status !== "open")
        fail(409, "Reopen this conversation before replying.");
      await c.query(
        "INSERT INTO support_messages(id,ticket_id,sender_id,client_key,body) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, req.account.id, input.clientKey, input.body],
      );
      await audit(
        c,
        req.account.id,
        admin ? "admin_support_reply" : "support_reply",
        id,
      );
      if (admin)
        await notify(
          c,
          ticket.user_id,
          "New message from Aplime support",
          "Open your support conversation to read and reply.",
          { page: "help", id },
        );
      else
        await notifyAdministrators(
          c,
          "New support reply",
          "A user replied to a support conversation.",
          { page: "support", id },
        );
    });
    res.json({ ok: true });
  });
  router.post("/conversations/:id/reopen", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT user_id,status FROM tickets WHERE id=$1" +
            (admin ? "" : " AND user_id=$2") +
            " FOR UPDATE",
          admin ? [id] : [id, req.account.id],
        )
      ).rows[0];
      if (!row) fail(404, "Support conversation not found.");
      if (row.status === "open") return;
      await c.query(
        "UPDATE tickets SET status='open',resolution=NULL WHERE id=$1",
        [id],
      );
      await audit(c, req.account.id, "support_reopen", id);
      if (admin)
        await notify(
          c,
          row.user_id,
          "Support conversation reopened",
          "You can reply to Aplime support.",
          { page: "help", id },
        );
      else
        await notifyAdministrators(
          c,
          "Support conversation reopened",
          "A user reopened their support conversation.",
          { page: "support", id },
        );
    });
    res.json({ ok: true });
  });
  return router;
}
