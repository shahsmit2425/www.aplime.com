import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { api } from "../src/server/api.js";
import { pool } from "../src/server/db/index.js";
const app = express();
app.use("/api", api);
app.use(
  (
    e: { status?: number; message: string },
    _q: express.Request,
    r: express.Response,
    _next: express.NextFunction,
  ) => {
    r.status(e.status || 500).json({ error: e.message });
  },
);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
test.after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  await pool.end();
});
test("actual admin routes reject unauthenticated direct requests and forged roles", async () => {
  for (const [path, method] of [
    ["/admin/workspace", "GET"],
    ["/admin/session", "GET"],
    ["/admin/overview", "GET"],
    ["/admin/users", "GET"],
    ["/admin/interactions", "GET"],
    ["/admin/notifications", "GET"],
    ["/admin/conversations/00000000-0000-4000-8000-000000000001", "GET"],
    ["/admin/files/00000000-0000-4000-8000-000000000001", "GET"],
    ["/admin/support/conversations", "GET"],
    ["/support/conversations", "GET"],
    [
      "/support/conversations/00000000-0000-4000-8000-000000000001/read",
      "POST",
    ],
    [
      "/admin/support/conversations/00000000-0000-4000-8000-000000000001/read",
      "POST",
    ],
    ["/discussions/00000000-0000-4000-8000-000000000001/read", "POST"],
    ["/ADMIN/workspace", "GET"],
    ["/admin/profiles/other", "POST"],
    ["/admin/tickets/other", "POST"],
    ["/workspace?role=admin", "GET"],
    ["/profile/identity", "GET"],
    ["/profile/identity", "POST"],
    ["/account", "POST"],
    ["/projects/00000000-0000-4000-8000-000000000001/actions", "POST"],
    ["/projects/00000000-0000-4000-8000-000000000001/activity", "GET"],
    ["/notifications/stream", "GET"],
    ["/profile/images/00000000-0000-4000-8000-000000000000/content", "PUT"],
  ]) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "POST"
        ? { body: JSON.stringify({ role: "admin", admin: true }) }
        : {}),
    });
    assert.equal(r.status, 401, path);
    const body = await r.json();
    assert.deepEqual(body, { error: "Sign in to continue." });
  }
});
test("public config exposes no admin allowlist or server credentials", async () => {
  const r = await fetch(base + "/api/config");
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.deepEqual(Object.keys(c).sort(), [
    "apiUrl",
    "environment",
    "firebase",
    "release",
    "sentryDsn",
    "siteUrl",
    "supportEmail",
  ]);
  assert.deepEqual(Object.keys(c.firebase).sort(), [
    "apiKey",
    "appId",
    "authDomain",
    "messagingSenderId",
    "projectId",
  ]);
});
