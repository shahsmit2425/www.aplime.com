import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import express from "express";
import { pool } from "../src/server/db/index.js";
import {
  subscribeNotifications,
  dispatchNotification,
  notificationStream,
  closeNotificationStream,
} from "../src/server/notification-stream.js";
test("live updates route only to the recipient and unsubscribe cleanly", () => {
  let a = 0,
    b = 0;
  const stopA = subscribeNotifications("a", () => a++),
    stopB = subscribeNotifications("b", () => b++);
  dispatchNotification("a");
  assert.equal(a, 1);
  assert.equal(b, 0);
  stopA();
  dispatchNotification("a");
  assert.equal(a, 1);
  dispatchNotification("b");
  assert.equal(b, 1);
  stopB();
});
test("SSE subscribes to PostgreSQL and sends private invalidations without message content", async () => {
  const pgClient = Object.assign(new EventEmitter(), {
    query: async (sql: string) => {
      assert.equal(sql, "LISTEN aplime_notifications");
    },
    release: () => {},
  });
  const original = pool.connect;
  pool.connect = (async () => pgClient) as any;
  const app = express();
  app.get("/stream", (req, res, next) => {
    req.account = {
      id: "stream-owner",
      name: "Test",
      email: "test@example.invalid",
      role: "customer",
      settings: {},
    };
    void notificationStream(req, res).catch(next);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const abort = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/stream`, {
      signal: abort.signal,
    });
    assert.match(response.headers.get("content-type")!, /text\/event-stream/);
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    reader = response.body!.getReader();
    assert.equal(
      new TextDecoder().decode((await reader.read()).value),
      "data: changed\n\n",
    );
    pgClient.emit("notification", {
      channel: "aplime_notifications",
      payload: "stream-owner",
    });
    assert.equal(
      new TextDecoder().decode((await reader.read()).value),
      "data: changed\n\n",
    );
  } finally {
    await reader?.cancel();
    abort.abort();
    closeNotificationStream();
    pool.connect = original;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
