import { Router } from "express";
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
} from "./integrations/storage.js";
export const businessImages = Router();
businessImages.use((req, _res, next) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  next();
});
businessImages.post("/", async (req, res) => {
  const data = businessImageSchema.parse(req.body);
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
    const url = await uploadUrl(key, data.contentType, data.size);
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
    return { id, url };
  });
  res.json(result);
});
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
  const files = await transaction(async (c) => {
    await c.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [
      req.account.id,
    ]);
    return (
      await c.query(
        "DELETE FROM business_images WHERE profile_id=$1 AND slot=$2 RETURNING object_key",
        [req.account.id, slot],
      )
    ).rows;
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
      "SELECT i.object_key FROM business_images i JOIN profiles p ON p.id=i.profile_id WHERE i.id=$1 AND i.status='ready' AND p.verified AND NOT p.suspended AND EXISTS(SELECT 1 FROM professional_subscriptions s WHERE s.user_id=p.id AND s.status IN ('active','trialing'))",
      [z.string().uuid().parse(req.params.id)],
    )
  ).rows[0];
  if (!f) fail(404, "Business image not available.");
  res.set("Cache-Control", "private, no-store");
  res.redirect(await imageUrl(f.object_key));
});
