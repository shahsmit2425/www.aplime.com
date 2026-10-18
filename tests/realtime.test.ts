import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import express from "express";
import { WebSocket } from "ws";

process.env.REDIS_URL = "redis://127.0.0.1:6379";
const { redis, redisChannel, cachedValue } =
  await import("../src/server/redis.js");
const { pool } = await import("../src/server/db/index.js");
const { attachRealtime, realtimeTicket } =
  await import("../src/server/realtime.js");
const { closeNotificationStream } =
  await import("../src/server/notification-stream.js");

test(
  "WebSocket tickets are single-use, origin checked and recipient scoped; Redis cache failures fall back",
  { timeout: 15000 },
  async () => {
    const values = new Map<string, string>();
    const expiries: number[] = [];
    let subscribed: ((message: string) => void) | undefined;
    const client = redis as any;
    Object.defineProperty(client, "isReady", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(client, "isOpen", {
      configurable: true,
      get: () => true,
    });
    client.set = async (
      key: string,
      value: string,
      options: { EX: number },
    ) => {
      values.set(key, value);
      expiries.push(options.EX);
    };
    client.get = async (key: string) => values.get(key) ?? null;
    client.getDel = async (key: string) => {
      const value = values.get(key);
      values.delete(key);
      return value;
    };
    client.publish = async (channel: string, message: string) => {
      assert.equal(channel, redisChannel);
      subscribed?.(message);
    };
    client.destroy = () => {};
    client.duplicate = () => ({
      on() {},
      connect: async () => {},
      subscribe: async (channel: string, fn: (message: string) => void) => {
        assert.equal(channel, redisChannel);
        subscribed = fn;
      },
      isOpen: true,
      destroy() {},
    });
    const pgClient = Object.assign(new EventEmitter(), {
      query: async () => {},
      release() {},
    });
    const originalConnect = pool.connect;
    pool.connect = (async () => pgClient) as any;
    const app = express();
    // Test fixture for the authenticated account normally supplied by API middleware.
    app.post("/ticket", (req, res) => {
      req.account = {
        id: "recipient",
        name: "Test",
        email: "test@example.invalid",
        role: "customer",
        settings: {},
      };
      return realtimeTicket(req, res);
    });
    const server = app.listen(0, "127.0.0.1");
    const stop = attachRealtime(
      server,
      new Set(["https://app.example.invalid"]),
    );
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const clients: WebSocket[] = [];
    const open = async (origin = "https://app.example.invalid") => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime`, {
        origin,
      });
      clients.push(socket);
      await once(socket, "open");
      return socket;
    };
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ticket`, {
        method: "POST",
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      const { ticket } = (await response.json()) as { ticket: string };
      assert.match(ticket, /^[a-f0-9]{64}$/);
      assert.equal(expiries[0], 20);
      const socket = await open();
      const messages: string[] = [];
      socket.on("message", (message) => messages.push(message.toString()));
      const initial = once(socket, "message");
      socket.send(JSON.stringify({ ticket }));
      await initial;
      assert.deepEqual(messages, ['{"type":"changed"}']);
      subscribed!("another-user");
      const own = once(socket, "message");
      subscribed!("recipient");
      await own;
      assert.equal(messages.length, 2);
      assert.ok(messages.every((message) => message === '{"type":"changed"}'));
      const reused = await open();
      const rejected = once(reused, "close");
      reused.send(JSON.stringify({ ticket }));
      assert.equal((await rejected)[0], 1008);
      const missing = await open();
      const missingClose = once(missing, "close");
      missing.send(JSON.stringify({ ticket: "a".repeat(64) }));
      assert.equal((await missingClose)[0], 1008);
      await assert.rejects(() => open("https://attacker.example.invalid"));
      let loads = 0;
      const load = async () => ({ count: ++loads });
      assert.deepEqual(await cachedValue("public", 30, load), { count: 1 });
      assert.deepEqual(await cachedValue("public", 30, load), { count: 1 });
      client.get = async () => {
        throw new Error("Redis offline");
      };
      client.set = async () => {
        throw new Error("Redis offline");
      };
      assert.deepEqual(await cachedValue("public", 30, load), { count: 2 });
      await assert.rejects(
        () =>
          cachedValue("public", 30, async () => {
            throw new Error("Database unavailable");
          }),
        /Database unavailable/,
      );
    } finally {
      clients.forEach((client) => client.terminate());
      stop();
      closeNotificationStream();
      pool.connect = originalConnect;
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
