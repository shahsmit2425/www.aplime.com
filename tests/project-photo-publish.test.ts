import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { S3Client } from "@aws-sdk/client-s3";
import {
  publishPhotos,
  type ProjectPhoto,
  type PhotoTransport,
} from "../src/client/project-photo-transfer.js";
process.env.R2_ACCOUNT_ID = "photo-test";
process.env.R2_ACCESS_KEY_ID = "fixture";
process.env.R2_SECRET_ACCESS_KEY = "fixture";
process.env.R2_BUCKET = "fixture";
const { pool } = await import("../src/server/db/index.js");
const { projectImages } = await import("../src/server/project-images.js");
const db = new PGlite();
for (const file of (await readdir("src/server/db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("src/server/db/migrations/" + file, "utf8"));
const query = async (sql: string, params?: unknown[]) => {
  const r = await db.query<any>(sql, params);
  return { ...r, rowCount: r.affectedRows || r.rows.length };
};
pool.query = query as typeof pool.query;
pool.connect = (async () => ({ query, release() {} })) as any;
for (const id of ["photo-customer", "photo-outsider"])
  await query(
    "INSERT INTO users(id,email,name,role) VALUES($1,$2,'Photo fixture','customer')",
    [id, id + "@example.invalid"],
  );
const projectId = randomUUID();
await query(
  "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,'photo-customer','New request','Fixture project','Cleaning','08859')",
  [projectId],
);
const store = new Map<string, { body: Buffer; type: string }>();
let puts = 0,
  corruptHead = false;
const originalSend = S3Client.prototype.send;
S3Client.prototype.send = (async (command: any) => {
  const input = command.input;
  if (command.constructor.name === "PutObjectCommand") {
    puts++;
    store.set(input.Key, {
      body: Buffer.from(input.Body),
      type: input.ContentType,
    });
    return {};
  }
  const file = store.get(input.Key);
  if (!file) throw new Error("Fixture object missing");
  if (command.constructor.name === "HeadObjectCommand")
    return {
      ContentType: file.type,
      ContentLength: file.body.length + (corruptHead ? 1 : 0),
    };
  if (command.constructor.name === "GetObjectCommand")
    return {
      Body: {
        transformToByteArray: async () =>
          new Uint8Array(file.body.subarray(0, 12)),
      },
    };
  throw new Error("Unexpected storage operation");
}) as any;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.account = {
    id:
      req.headers["x-user"] === "outsider"
        ? "photo-outsider"
        : "photo-customer",
    role: "customer",
    name: "Fixture",
    email: "fixture@example.invalid",
    settings: {},
  };
  next();
});
app.use(projectImages);
app.use((e: any, _q: any, r: any, _n: any) =>
  r
    .status(e.status || (e.name === "ZodError" ? 400 : 500))
    .json({ error: e.message }),
);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + (server.address() as any).port;
const post = (path: string, body: unknown, outsider = false) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user": outsider ? "outsider" : "customer",
    },
    body: JSON.stringify(body),
  });
const put = (path: string, body: File | Buffer, outsider = false) =>
  fetch(base + path, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
      "x-user": outsider ? "outsider" : "customer",
    },
    body: body instanceof File ? body : new Uint8Array(body),
  });
async function photo(color: string): Promise<ProjectPhoto> {
  const bytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: color },
  })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: "PRIVATE-METADATA" } })
    .toBuffer();
  return {
    key: randomUUID(),
    file: new File([new Uint8Array(bytes)], "work.jpg", { type: "image/jpeg" }),
    preview: "blob:fixture",
  };
}
test.after(async () => {
  S3Client.prototype.send = originalSend;
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
  await pool.end();
});

test("first project photo publishing survives lost PUT/commit responses and commits all images once", async () => {
  const photos = [await photo("#137747"), await photo("#ffcc00")];
  let loseReservation = true,
    losePut = true,
    loseCommit = true,
    reservations = 0,
    uploads = 0;
  const transport: PhotoTransport = {
    request: async (path, body) => {
      if (path.endsWith("/reservations")) reservations++;
      const r = await post(path, body),
        result = await r.json();
      if (!r.ok)
        throw Object.assign(new Error(result.error), { status: r.status });
      if (path.endsWith("/reservations") && loseReservation) {
        loseReservation = false;
        throw new Error("Lost reservation response");
      }
      if (path.endsWith("/photos/complete") && loseCommit) {
        loseCommit = false;
        throw new Error("Lost completion response");
      }
      return result;
    },
    upload: async (path, file) => {
      uploads++;
      const r = await put(path, file),
        result = await r.json();
      if (!r.ok) throw new Error(result.error);
      if (losePut) {
        losePut = false;
        throw new Error("Lost upload response");
      }
    },
  };
  await assert.rejects(
    publishPhotos(projectId, photos, transport),
    /Lost reservation/,
  );
  await assert.rejects(
    publishPhotos(projectId, photos, transport),
    /Lost upload/,
  );
  const uploaded = (
    await query("SELECT * FROM uploads WHERE id=$1", [photos[0].uploadId])
  ).rows[0];
  assert.equal(uploaded.source_size, photos[0].file.size);
  assert.notEqual(uploaded.size, uploaded.source_size);
  corruptHead = true;
  await assert.rejects(
    publishPhotos(projectId, photos, transport),
    /finish uploading correctly/,
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM uploads WHERE status='ready'"))
      .rows[0].n,
    0,
    "failed verification commits no partial photo selection",
  );
  assert.ok(photos.every((p) => !p.transferred && !p.done));
  corruptHead = false;
  await assert.rejects(
    publishPhotos(projectId, photos, transport),
    /Lost completion/,
  );
  await publishPhotos(projectId, photos, transport);
  assert.ok(photos.every((p) => p.done && p.saved));
  assert.equal(reservations, 3);
  assert.equal(uploads, 5);
  assert.equal(puts, 5);
  assert.equal(
    (await query("SELECT count(*)::int n FROM projects")).rows[0].n,
    1,
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM uploads WHERE status='ready'"))
      .rows[0].n,
    2,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM project_activity WHERE action='photos_added'",
      )
    ).rows[0].n,
    1,
  );
  for (const file of store.values()) {
    assert.equal((await sharp(file.body).metadata()).exif, undefined);
    assert.equal(file.body.includes(Buffer.from("PRIVATE-METADATA")), false);
  }
  const oldUrl = `/uploads/${photos[0].uploadId}/complete`;
  assert.equal(
    (await post(oldUrl, {})).status,
    200,
    "already-open clients retain a safe compatibility route",
  );
  assert.equal((await post(oldUrl, {}, true)).status, 404);
  assert.equal(
    (await put(`/project-photos/${photos[0].uploadId}/content`, photos[0].file))
      .status,
    200,
  );
  const different = Buffer.from(await photos[0].file.arrayBuffer());
  different[different.length - 1] ^= 1;
  assert.equal(
    (await put(`/project-photos/${photos[0].uploadId}/content`, different))
      .status,
    409,
    "a saved photo cannot be overwritten",
  );
  assert.equal(puts, 5);
});

test("completion rejects missing receipt, foreign/duplicate IDs, and safely repairs legacy pending photos", async () => {
  const file = await photo("#777777");
  const r = await post(`/projects/${projectId}/photos/reservations`, {
    name: file.file.name,
    contentType: file.file.type,
    size: file.file.size,
  });
  const reserved = await r.json();
  assert.equal(
    (await post(`/uploads/${reserved.id}/complete`, {})).status,
    409,
  );
  assert.equal(
    (
      await post(
        `/projects/${projectId}/photos/complete`,
        { photoIds: [reserved.id] },
        true,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await post(`/projects/${projectId}/photos/complete`, {
        photoIds: [reserved.id, reserved.id],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(`/projects/${projectId}/photos/complete`, {
        photoIds: [randomUUID()],
      })
    ).status,
    404,
  );
  // Previously processed pending rows cannot recover their original size by inference.
  // Re-uploading through the sanitizing route establishes a real receipt instead.
  await query("UPDATE uploads SET source_size=NULL,size=10 WHERE id=$1", [
    reserved.id,
  ]);
  assert.equal((await put(reserved.uploadPath, file.file)).status, 200);
  assert.equal(
    (await post(`/uploads/${reserved.id}/complete`, {})).status,
    200,
  );
  assert.ok(
    (
      await query(
        "SELECT source_hash,content_received_at FROM uploads WHERE id=$1",
        [reserved.id],
      )
    ).rows[0].content_received_at,
  );
});

test("append completion preserves existing photos and enforces the five-image limit", async () => {
  for (let i = 0; i < 2; i++) {
    const file = await photo("#224477");
    const r = await post(`/projects/${projectId}/photos/reservations`, {
      name: file.file.name,
      contentType: file.file.type,
      size: file.file.size,
    });
    const reserved = await r.json();
    assert.equal((await put(reserved.uploadPath, file.file)).status, 200);
    assert.equal(
      (await post(`/project-photos/${reserved.id}/complete`, {})).status,
      200,
    );
  }
  const file = await photo("#112233"),
    r = await post(`/projects/${projectId}/photos/reservations`, {
      name: file.file.name,
      contentType: file.file.type,
      size: file.file.size,
    }),
    reserved = await r.json();
  await put(reserved.uploadPath, file.file);
  assert.equal(
    (await post(`/uploads/${reserved.id}/complete`, {})).status,
    409,
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM uploads WHERE status='ready'"))
      .rows[0].n,
    5,
  );
  await query("UPDATE projects SET status='cancelled' WHERE id=$1", [
    projectId,
  ]);
  assert.equal(
    (await post(`/uploads/${reserved.id}/complete`, {})).status,
    409,
  );
});
