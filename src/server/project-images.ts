import { Router, raw } from "express";
import { randomUUID, createHash } from "node:crypto";
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
import { sanitizeImage } from "./image-processing.js";
import {
  inspectObject,
  imageHeader,
  storeBusinessImage,
} from "./integrations/storage.js";
import { recordProjectActivity } from "./project-events.js";
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
    .extend({
      contentType: z.enum(IMAGE_TYPES),
      clientKey: z.string().uuid().optional(),
    })
    .strict()
    .parse(req.body);
  const projectId = z.string().uuid().parse(req.params.id);
  let id: string = randomUUID();
  const key = `${env.APP_ENV}/${projectId}/${id}`;
  await transaction(async (c) => {
    await editable(c, projectId, req.account.id);
    if (data.clientKey) {
      const previous = (
        await c.query(
          "SELECT * FROM uploads WHERE project_id=$1 AND user_id=$2 AND client_key=$3",
          [projectId, req.account.id, data.clientKey],
        )
      ).rows[0];
      if (previous) {
        if (
          previous.name !== data.name ||
          previous.content_type !== data.contentType ||
          previous.source_size !== data.size
        )
          fail(
            409,
            "This photo request was already used for another file. Choose the photo again.",
          );
        id = previous.id;
        return;
      }
    }
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
      "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size,source_size,client_key) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)",
      [
        id,
        projectId,
        req.account.id,
        key,
        data.name,
        data.contentType,
        data.size,
        data.clientKey || null,
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
          "SELECT 1 FROM uploads WHERE id=$1 AND user_id=$2 AND status IN ('pending','ready') AND content_type LIKE 'image/%'",
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
        if (!f) fail(404, "Photo unavailable.");
        const sourceHash = createHash("sha256").update(req.body).digest("hex");
        if (
          (f.source_size !== null && f.source_size !== req.body.length) ||
          f.content_type !== req.get("content-type") ||
          !matchesImageSignature(f.content_type, req.body)
        )
          fail(400, "This file does not match the selected photo.");
        if (f.status === "ready") {
          if (f.source_hash !== sourceHash)
            fail(
              409,
              "This photo is already saved. Use the editor to replace it.",
            );
          return;
        }
        if (f.status !== "pending")
          fail(409, "This upload is no longer pending.");
        const clean = await sanitizeImage(req.body, f.content_type);
        await storeBusinessImage(f.object_key, f.content_type, clean);
        await c.query(
          "UPDATE uploads SET size=$2,source_size=$3,source_hash=$4,content_received_at=now() WHERE id=$1",
          [f.id, clean.length, req.body.length, sourceHash],
        );
      });
      res.json({ ok: true });
    } finally {
      res.locals.releaseProjectPhoto?.();
    }
  },
);
projectImages.post("/projects/:id/photos/complete", async (req, res) => {
  const projectId = z.string().uuid().parse(req.params.id);
  const { photoIds } = z
    .object({
      photoIds: z.array(z.string().uuid()).min(1).max(MAX_PROJECT_IMAGES),
    })
    .strict()
    .parse(req.body);
  await transaction((c) =>
    completeNewProjectPhotos(c, projectId, req.account.id, photoIds),
  );
  res.json({ ok: true });
});
// Compatibility for already-open clients using the former completion URL.
// Only owner-authorized, API-sanitized project photos can be completed here.
projectImages.post(
  ["/project-photos/:id/complete", "/uploads/:id/complete"],
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    z.object({}).strict().parse(req.body);
    await transaction(async (c) => {
      const file = (
        await c.query(
          "SELECT project_id FROM uploads WHERE id=$1 AND user_id=$2 AND content_type LIKE 'image/%'",
          [id, req.account.id],
        )
      ).rows[0];
      if (!file) fail(404, "Photo unavailable.");
      await completeNewProjectPhotos(c, file.project_id, req.account.id, [id]);
    });
    res.json({ ok: true });
  },
);

async function completeNewProjectPhotos(
  c: pg.PoolClient,
  projectId: string,
  userId: string,
  photoIds: string[],
) {
  await editable(c, projectId, userId);
  if (new Set(photoIds).size !== photoIds.length)
    fail(400, "A photo cannot appear twice.");
  const files = (
    await c.query(
      "SELECT * FROM uploads WHERE project_id=$1 AND user_id=$2 AND content_type LIKE 'image/%' FOR UPDATE",
      [projectId, userId],
    )
  ).rows;
  const selected = photoIds.map((id) => files.find((f) => f.id === id));
  if (selected.some((f) => !f))
    fail(404, "One of these photos is unavailable.");
  const pending = selected.filter((f) => f.status !== "ready");
  if (!pending.length) return;
  if (pending.some((f) => !f.content_received_at || !f.source_hash))
    fail(
      409,
      "A photo did not finish uploading. Retry the photo upload before saving.",
    );
  const readyIds = files.filter((f) => f.status === "ready").map((f) => f.id);
  await commitProjectPhotos(c, projectId, userId, {
    expectedIds: readyIds,
    photoIds: [...readyIds, ...pending.map((f) => f.id)],
  });
  await c.query("UPDATE projects SET version=version+1 WHERE id=$1", [
    projectId,
  ]);
  await recordProjectActivity(
    c,
    projectId,
    userId,
    "photos_added",
    `${pending.length} project photo${pending.length === 1 ? "" : "s"} added`,
  );
}
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
