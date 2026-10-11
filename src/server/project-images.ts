import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type pg from "pg";
import { pool, transaction } from "./db/index.js";
import { env } from "./config.js";
import { fail } from "./errors.js";
import {
  uploadSchema,
  IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_PROJECT_IMAGES,
} from "../shared/uploads.js";
import { matchesImageSignature } from "../shared/business-images.js";
import {
  inspectObject,
  imageHeader,
  storeBusinessImage,
} from "./integrations/storage.js";
export const projectImages = Router();
async function editable(
  c: Pick<pg.PoolClient, "query">,
  projectId: string,
  userId: string,
) {
  const p = (
    await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId])
  ).rows[0];
  if (!p || p.customer_id !== userId) fail(404, "Project unavailable.");
  if (!["requested", "quoted"].includes(p.status))
    fail(409, "This project can no longer be edited.");
}
projectImages.post("/projects/:id/photos/reservations", async (req, res) => {
  const data = uploadSchema
    .extend({ contentType: z.enum(IMAGE_TYPES) })
    .strict()
    .parse(req.body);
  const projectId = z.string().uuid().parse(req.params.id);
  const id = randomUUID(),
    key = `${env.APP_ENV}/${projectId}/${id}`;
  await transaction(async (c) => {
    await editable(c, projectId, req.account.id);
    const counts = (
      await c.query(
        "SELECT count(*)::int AS n FROM uploads WHERE project_id=$1 AND user_id=$2 AND status='pending' AND content_type LIKE 'image/%'",
        [projectId, req.account.id],
      )
    ).rows[0];
    if (counts.n >= MAX_PROJECT_IMAGES)
      fail(
        409,
        "Finish or remove your unfinished photo uploads before adding more.",
      );
    await c.query(
      "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        projectId,
        req.account.id,
        key,
        data.name,
        data.contentType,
        data.size,
      ],
    );
  });
  res.json({ id, uploadPath: `/project-photos/${id}/content` });
});
// Like business images, authenticated API uploads avoid browser-to-R2 CORS.
// Bound buffering to four files per API instance and one per account.
const receiving = new Set<string>();
projectImages.put(
  "/project-photos/:id/content",
  async (req, res, next) => {
    const id = z.string().uuid().parse(req.params.id);
    if (
      !(
        await pool.query(
          "SELECT 1 FROM uploads WHERE id=$1 AND user_id=$2 AND status='pending' AND content_type LIKE 'image/%'",
          [id, req.account.id],
        )
      ).rowCount
    )
      fail(404, "Pending photo unavailable.");
    if (
      !IMAGE_TYPES.includes(
        req.get("content-type") as (typeof IMAGE_TYPES)[number],
      )
    )
      fail(415, "Choose a JPG, PNG or WebP image.");
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
    res.locals.releaseProjectPhoto = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!res.locals.processingProjectPhoto) release();
    });
    next();
  },
  raw({ type: [...IMAGE_TYPES], limit: MAX_UPLOAD_BYTES, inflate: false }),
  async (req, res) => {
    res.locals.processingProjectPhoto = true;
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Choose a non-empty photo.");
      await transaction(async (c) => {
        const candidate = (
          await c.query(
            "SELECT project_id FROM uploads WHERE id=$1 AND user_id=$2",
            [req.params.id, req.account.id],
          )
        ).rows[0];
        if (!candidate) fail(404, "Photo unavailable.");
        await editable(c, candidate.project_id, req.account.id);
        const f = (
          await c.query(
            "SELECT * FROM uploads WHERE id=$1 AND user_id=$2 FOR UPDATE",
            [req.params.id, req.account.id],
          )
        ).rows[0];
        if (!f || f.status !== "pending")
          fail(409, "This upload is no longer pending.");
        if (
          f.size !== req.body.length ||
          f.content_type !== req.get("content-type") ||
          !matchesImageSignature(f.content_type, req.body)
        )
          fail(400, "This file does not match the selected photo.");
        await storeBusinessImage(f.object_key, f.content_type, req.body);
      });
      res.json({ ok: true });
    } finally {
      res.locals.releaseProjectPhoto?.();
    }
  },
);
// Called inside update_details: text and the complete photo selection commit
// together. A failed upload/validation leaves every existing image unchanged.
export async function commitProjectPhotos(
  c: pg.PoolClient,
  projectId: string,
  userId: string,
  selection: { expectedIds: string[]; photoIds: string[] },
  verify = async (f: any) => {
    const head = await inspectObject(f.object_key);
    if (
      head.ContentLength !== f.size ||
      head.ContentType !== f.content_type ||
      !matchesImageSignature(f.content_type, await imageHeader(f.object_key))
    )
      fail(
        400,
        "A photo did not finish uploading correctly. Retry before saving.",
      );
  },
) {
  const files = (
    await c.query(
      "SELECT * FROM uploads WHERE project_id=$1 AND content_type LIKE 'image/%' FOR UPDATE",
      [projectId],
    )
  ).rows;
  const current = files.filter(
    (f) => f.user_id === userId && f.status === "ready",
  );
  const same = (a: string[], b: string[]) =>
    a.length === b.length &&
    [...a].sort().every((id, i) => id === [...b].sort()[i]);
  if (
    !same(
      current.map((f) => f.id),
      selection.expectedIds,
    )
  )
    fail(
      409,
      "Project photos changed in another session. Reopen the editor before saving.",
    );
  const ids = [...new Set(selection.photoIds)];
  if (ids.length !== selection.photoIds.length)
    fail(400, "A photo cannot appear twice.");
  const chosen = ids.map((id) =>
    files.find((f) => f.id === id && f.user_id === userId),
  );
  if (chosen.some((f) => !f)) fail(404, "One of these photos is unavailable.");
  if (
    ids.length +
      files.filter((f) => f.user_id !== userId && f.status === "ready").length >
    MAX_PROJECT_IMAGES
  )
    fail(409, "A project can have up to 5 images.");
  for (const f of chosen) if (f.status !== "ready") await verify(f);
  await c.query("UPDATE uploads SET status='ready' WHERE id=ANY($1::uuid[])", [
    ids,
  ]);
  const removed = current.filter((f) => !ids.includes(f.id));
  await c.query("DELETE FROM uploads WHERE id=ANY($1::uuid[])", [
    removed.map((f) => f.id),
  ]);
  return removed.map((f) => f.object_key as string);
}
