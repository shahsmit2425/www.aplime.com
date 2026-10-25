import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "./db/index.js";
import { fail } from "./errors.js";
import { env } from "./config.js";
import { sanitizeImage } from "./image-processing.js";
import {
  imageUrl,
  storeBusinessImage,
  removeObject,
} from "./integrations/storage.js";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../shared/uploads.js";
export const reviewImages = Router();
const projectId = (value: unknown) => z.string().uuid().parse(value);
const slotId = (value: unknown) =>
  z.coerce.number().int().min(1).max(10).parse(value);
export async function reviewPhotos(id: string) {
  const rows = (
    await pool.query(
      "SELECT slot,object_key FROM review_images WHERE project_id=$1 ORDER BY slot",
      [id],
    )
  ).rows;
  return Promise.all(
    rows.map(async (r) => ({
      slot: r.slot,
      url: await imageUrl(r.object_key),
    })),
  );
}
reviewImages.get("/projects/:id/review-photos", async (req, res) => {
  const id = projectId(req.params.id);
  const access = (
    await pool.query(
      "SELECT 1 FROM projects p WHERE p.id=$1 AND (p.customer_id=$2 OR (p.pro_id=$2 AND EXISTS(SELECT 1 FROM reviews r WHERE r.project_id=p.id)))",
      [id, req.account.id],
    )
  ).rowCount;
  if (!access) fail(404, "Project unavailable.");
  res.set("Cache-Control", "no-store").json(await reviewPhotos(id));
});
const receiving = new Set<string>();
reviewImages.put(
  "/projects/:id/review-photos/:slot",
  async (req, res, next) => {
    const id = projectId(req.params.id);
    slotId(req.params.slot);
    if (
      !(
        await pool.query(
          "SELECT 1 FROM projects WHERE id=$1 AND customer_id=$2 AND status='completed' AND pro_id IS NOT NULL",
          [id, req.account.id],
        )
      ).rowCount
    )
      fail(403, "Only the customer can add review photos for completed work.");
    if (
      !(IMAGE_TYPES as readonly string[]).includes(
        req.get("content-type") || "",
      )
    )
      fail(415, "Choose JPG, PNG or WebP images.");
    if (receiving.size >= 4 || receiving.has(req.account.id))
      fail(429, "Another image is uploading. Try again shortly.");
    receiving.add(req.account.id);
    const release = () => receiving.delete(req.account.id);
    res.locals.release = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!res.locals.processing) release();
    });
    next();
  },
  raw({ type: [...IMAGE_TYPES], limit: MAX_UPLOAD_BYTES, inflate: false }),
  async (req, res) => {
    res.locals.processing = true;
    const id = projectId(req.params.id),
      slot = slotId(req.params.slot),
      key = `${env.APP_ENV}/reviews/${id}/${randomUUID()}`;
    let old: string | undefined,
      stored = false;
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Choose a non-empty image.");
      const clean = await sanitizeImage(req.body, req.get("content-type")!);
      await transaction(async (c) => {
        // Match account deletion's lock order so uploads cannot survive deletion.
        const user = (
          await c.query("SELECT deleted_at FROM users WHERE id=$1 FOR UPDATE", [
            req.account.id,
          ])
        ).rows[0];
        if (!user || user.deleted_at) fail(403, "Account unavailable.");
        const p = (
          await c.query(
            "SELECT customer_id,status FROM projects WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!p || p.customer_id !== req.account.id || p.status !== "completed")
          fail(403, "Project unavailable.");
        old = (
          await c.query(
            "SELECT object_key FROM review_images WHERE project_id=$1 AND slot=$2",
            [id, slot],
          )
        ).rows[0]?.object_key;
        await storeBusinessImage(key, req.get("content-type")!, clean);
        stored = true;
        await c.query(
          "INSERT INTO review_images(project_id,slot,object_key) VALUES($1,$2,$3) ON CONFLICT(project_id,slot) DO UPDATE SET object_key=$3,created_at=now()",
          [id, slot, key],
        );
      });
      if (old)
        void removeObject(old).catch(() =>
          console.error("Review image cleanup deferred"),
        );
      res.json({ ok: true });
    } catch (error) {
      if (stored) await removeObject(key).catch(() => {});
      throw error;
    } finally {
      res.locals.release?.();
    }
  },
);
reviewImages.delete("/projects/:id/review-photos/:slot", async (req, res) => {
  const id = projectId(req.params.id),
    slot = slotId(req.params.slot);
  const row = await transaction(async (c) => {
    const p = (
      await c.query("SELECT customer_id FROM projects WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (!p || p.customer_id !== req.account.id)
      fail(403, "Only the customer can remove these photos.");
    return (
      await c.query(
        "DELETE FROM review_images WHERE project_id=$1 AND slot=$2 RETURNING object_key",
        [id, slot],
      )
    ).rows[0];
  });
  if (row)
    void removeObject(row.object_key).catch(() =>
      console.error("Review image cleanup deferred"),
    );
  res.json({ ok: true });
});
