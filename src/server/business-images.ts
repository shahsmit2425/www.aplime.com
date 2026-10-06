import { Router, raw } from "express";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../shared/uploads.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "./db/index.js";
import { fail } from "./errors.js";
import { env } from "./config.js";
import {
  businessImageSchema,
  businessImageSlots,
  matchesImageSignature,
} from "../shared/business-images.js";
import {
  imageUrl,
  imageHeader,
  uploadUrl,
  inspectObject,
  removeObject,
  storeBusinessImage,
} from "./integrations/storage.js";
import { notifyAdministrators } from "./repository.js";
import type pg from "pg";
// A listed business keeps its public listing while photo changes are
// re-reviewed; unlisted ones return to draft and resubmit manually.
async function resetReview(c: pg.PoolClient, profileId: string) {
  const reviewed = (
    await c.query(
      "UPDATE profiles SET review_status=CASE WHEN listed THEN 'pending' ELSE 'draft' END,review_note=NULL,submitted_at=CASE WHEN listed THEN now() ELSE NULL END,reviewed_at=NULL,reviewed_by=NULL WHERE id=$1 RETURNING listed,business",
      [profileId],
    )
  ).rows[0];
  if (reviewed?.listed)
    await notifyAdministrators(
      c,
      "Listed business photos updated",
      reviewed.business +
        " changed photos on its live listing. Review the updates in the administrator console.",
    );
}
export const businessImages = Router();
businessImages.use((req, _res, next) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  next();
});
businessImages.post("/", async (req, res) => {
  const data = businessImageSchema
    .extend({ transport: z.enum(["direct", "api"]).default("direct") })
    .parse(req.body);
  const result = await transaction(async (c) => {
    if (
      !(
        await c.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [
          req.account.id,
        ])
      ).rowCount
    )
      fail(409, "Save your business details before adding images.");
    const pending = (
      await c.query(
        "SELECT id,object_key FROM business_images WHERE profile_id=$1 AND slot=$2 AND status='pending'",
        [req.account.id, data.slot],
      )
    ).rows[0];
    const id = pending?.id || randomUUID(),
      key =
        pending?.object_key ||
        `${env.APP_ENV}/business/${req.account.id}/${id}`;
    const url =
      data.transport === "direct"
        ? await uploadUrl(key, data.contentType, data.size)
        : undefined;
    await c.query(
      "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(profile_id,slot,status) DO UPDATE SET name=EXCLUDED.name,content_type=EXCLUDED.content_type,size=EXCLUDED.size",
      [
        id,
        req.account.id,
        data.slot,
        key,
        data.name,
        data.contentType,
        data.size,
      ],
    );
    return {
      id,
      ...(url ? { url } : { uploadPath: "/profile/images/" + id + "/content" }),
    };
  });
  res.json(result);
});
// Bound buffering to four 10 MB files per API process, one per account.
const receiving = new Set<string>();
businessImages.put(
  "/:id/content",
  async (req, res, next) => {
    const id = z.string().uuid().parse(req.params.id);
    if (
      !(
        await pool.query(
          "SELECT 1 FROM business_images WHERE id=$1 AND profile_id=$2 AND status='pending'",
          [id, req.account.id],
        )
      ).rowCount
    )
      fail(404, "Pending image not found. Choose the image again.");
    if (
      !IMAGE_TYPES.includes(
        req.get("content-type") as (typeof IMAGE_TYPES)[number],
      )
    )
      fail(415, "Choose a JPG, PNG, or WebP image.");
    if (receiving.size >= 4 || receiving.has(req.account.id))
      fail(429, "Another image is uploading. Please retry shortly.");
    receiving.add(req.account.id);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        receiving.delete(req.account.id);
      }
    };
    res.locals.releaseImageUpload = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!res.locals.processingImageUpload) release();
    });
    next();
  },
  raw({ type: [...IMAGE_TYPES], limit: MAX_UPLOAD_BYTES, inflate: false }),
  async (req, res) => {
    res.locals.processingImageUpload = true;
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Choose a non-empty image.");
      await transaction(async (c) => {
        await c.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [
          req.account.id,
        ]);
        const f = (
          await c.query(
            "SELECT * FROM business_images WHERE id=$1 AND profile_id=$2 FOR UPDATE",
            [req.params.id, req.account.id],
          )
        ).rows[0];
        if (!f || f.status !== "pending")
          fail(
            409,
            "This upload is no longer pending. Refresh your business images.",
          );
        if (
          f.size !== req.body.length ||
          f.content_type !== req.get("content-type") ||
          !matchesImageSignature(f.content_type, req.body)
        )
          fail(
            400,
            "This file does not match the selected image. Choose a JPG, PNG, or WebP image again.",
          );
        await storeBusinessImage(f.object_key, f.content_type, req.body);
      });
      res.json({ ok: true });
    } finally {
      res.locals.releaseImageUpload?.();
    }
  },
);
businessImages.post("/:id/complete", async (req, res) => {
  const oldKeys: string[] = [];
  await transaction(async (c) => {
    await c.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [
      req.account.id,
    ]);
    const f = (
      await c.query(
        "SELECT * FROM business_images WHERE id=$1 AND profile_id=$2 FOR UPDATE",
        [z.string().uuid().parse(req.params.id), req.account.id],
      )
    ).rows[0];
    if (!f) fail(404, "Image not found.");
    if (f.status === "ready") return;
    const head = await inspectObject(f.object_key);
    if (
      head.ContentLength !== f.size ||
      head.ContentType !== f.content_type ||
      !matchesImageSignature(f.content_type, await imageHeader(f.object_key))
    )
      fail(
        400,
        "The uploaded file is not a supported image or does not match its declared size. Choose a JPG, PNG, or WebP image.",
      );
    const old = await c.query(
      "DELETE FROM business_images WHERE profile_id=$1 AND slot=$2 AND status='ready' RETURNING object_key",
      [req.account.id, f.slot],
    );
    oldKeys.push(...old.rows.map((r) => r.object_key));
    await c.query("UPDATE business_images SET status='ready' WHERE id=$1", [
      f.id,
    ]);
    await resetReview(c, req.account.id);
  });
  for (const key of oldKeys)
    try {
      await removeObject(key);
    } catch {
      console.error("Replaced business image object cleanup failed");
    }
  res.json({ ok: true });
});
businessImages.delete("/:slot", async (req, res) => {
  const slot = z.enum(businessImageSlots).parse(req.params.slot);
  const { imageId } = z
    .object({ imageId: z.string().uuid().optional() })
    .strict()
    .parse(req.body || {});
  const files = await transaction(async (c) => {
    await c.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [
      req.account.id,
    ]);
    if (imageId) {
      const current = (
        await c.query(
          "SELECT id FROM business_images WHERE profile_id=$1 AND slot=$2 AND status='ready'",
          [req.account.id, slot],
        )
      ).rows[0];
      if (!current) return [];
      if (current.id !== imageId)
        fail(
          409,
          "This image was replaced in another session. Refresh before deleting it.",
        );
    }
    const removed = (
      await c.query(
        "DELETE FROM business_images WHERE profile_id=$1 AND slot=$2 RETURNING object_key",
        [req.account.id, slot],
      )
    ).rows;
    if (removed.length) await resetReview(c, req.account.id);
    return removed;
  });
  for (const f of files)
    try {
      await removeObject(f.object_key);
    } catch {
      console.error("Removed business image object cleanup failed");
    }
  res.json({ ok: true });
});
export const publicBusinessImages = Router();
publicBusinessImages.get("/business-images/:id", async (req, res) => {
  const f = (
    await pool.query(
      "SELECT i.object_key FROM business_images i JOIN profiles p ON p.id=i.profile_id WHERE i.id=$1 AND i.status='ready' AND p.verified AND (p.review_status='approved' OR p.listed) AND NOT p.suspended AND EXISTS(SELECT 1 FROM professional_subscriptions s WHERE s.user_id=p.id AND s.status IN ('active','trialing'))",
      [z.string().uuid().parse(req.params.id)],
    )
  ).rows[0];
  if (!f) fail(404, "Business image not available.");
  res.set("Cache-Control", "private, no-store");
  res.redirect(await imageUrl(f.object_key));
});
