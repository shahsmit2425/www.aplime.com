import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import express from "express";
import { imageUploadBody } from "../src/server/upload-body.js";
import { checkAuthenticatedLimit } from "../src/server/abuse-limits.js";

test("workspace fallback is bounded; mutations, other routes and explicit quota denials stay protected", async () => {
  const unavailable = {
    limit: async () => {
      throw Error("offline");
    },
  } as any;
  const timeout = {
    limit: async () => ({ success: true, reason: "timeout" }),
  } as any;
  for (let i = 0; i < 12; i++)
    await checkAuthenticatedLimit(
      i % 2 ? unavailable : timeout,
      "reader",
      true,
    );
  await assert.rejects(
    () => checkAuthenticatedLimit(unavailable, "reader", true),
    { status: 429 },
  );
  await checkAuthenticatedLimit(timeout, "other-reader", true);
  await assert.rejects(
    () => checkAuthenticatedLimit(timeout, "writer", false),
    { status: 503 },
  );
  await assert.rejects(
    () => checkAuthenticatedLimit(unavailable, "sensitive-read", false),
    { status: 503 },
  );
  await assert.rejects(
    () =>
      checkAuthenticatedLimit(
        { limit: async () => ({ success: false }) } as any,
        "reader",
        true,
      ),
    { status: 429 },
  );
});

test("four stalled accounts expire or disconnect and other photo uploads can finish", async () => {
  const app = express();
  const body = imageUploadBody(1000);
  let arrived = 0;
  let ready!: () => void;
  const stalled = new Promise<void>((resolve) => {
    ready = resolve;
  });
  app.put(
    "/",
    (req, res, next) => {
      req.account = {
        id: String(req.headers["x-account"]),
      } as typeof req.account;
      if (++arrived === 4) ready();
      next();
    },
    body,
    (req, res) => {
      res.locals.releaseUpload();
      res.sendStatus(204);
    },
  );
  app.use(
    (
      e: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.sendStatus(e.status || 500),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const sockets = Array.from({ length: 4 }, (_, i) => {
    const r = request(url, {
      method: "PUT",
      headers: {
        "x-account": String(i),
        "content-type": "image/png",
        "content-length": "20",
      },
    });
    r.on("error", () => {});
    r.write("x");
    return r;
  });
  const finished = Promise.all(
    sockets.map(
      (r) => new Promise<void>((resolve) => r.once("close", resolve)),
    ),
  );
  const upload = () =>
    fetch(url, {
      method: "PUT",
      headers: { "content-type": "image/png", "x-account": "fifth" },
      body: "ok",
    });
  try {
    await stalled;
    assert.equal((await upload()).status, 429);
    sockets[0].destroy();
    await finished;
    assert.equal((await upload()).status, 204);
  } finally {
    for (const r of sockets) r.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
