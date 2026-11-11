import { Router } from "express";
import { z } from "zod";
import { pool, camel } from "./db/index.js";
import { fail } from "./errors.js";
export const projectDrafts = Router();
const projectDraftSchema = z.record(z.string().max(64), z.unknown());
projectDrafts.get("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const row = (
    await pool.query(
      "SELECT payload,updated_at FROM project_drafts WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0];
  res.json(row ? camel(row) : { payload: null, updatedAt: null });
});
projectDrafts.put("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const payload = projectDraftSchema.parse(req.body);
  if (JSON.stringify(payload).length > 30000) fail(413, "Draft is too large.");
  const saved = await pool.query(
    "INSERT INTO project_drafts(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=$2,updated_at=now() RETURNING updated_at",
    [req.account.id, JSON.stringify(payload)],
  );
  res.json({ ok: true, updatedAt: saved.rows[0].updated_at });
});
projectDrafts.delete("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const { updatedAt } = z
    .object({ updatedAt: z.string().datetime().optional() })
    .strict()
    .parse(req.body || {});
  const removed = await pool.query(
    "DELETE FROM project_drafts WHERE user_id=$1" +
      (updatedAt
        ? " AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$2::timestamptz)"
        : ""),
    updatedAt ? [req.account.id, updatedAt] : [req.account.id],
  );
  if (
    updatedAt &&
    !removed.rowCount &&
    (
      await pool.query("SELECT 1 FROM project_drafts WHERE user_id=$1", [
        req.account.id,
      ])
    ).rowCount
  )
    fail(
      409,
      "Your draft changed in another session. Review the latest version before discarding it.",
    );
  res.json({ ok: true });
});
