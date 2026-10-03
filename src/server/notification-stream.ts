import type { Request, Response } from "express";
import type pg from "pg";
import { pool } from "./db/index.js";
const listeners = new Map<string, Set<() => void>>();
let client: pg.PoolClient | undefined;
let connecting: Promise<void> | undefined;
export function subscribeNotifications(userId: string, callback: () => void) {
  const group = listeners.get(userId) || new Set<() => void>();
  group.add(callback);
  listeners.set(userId, group);
  return () => {
    group.delete(callback);
    if (!group.size) listeners.delete(userId);
  };
}
export function dispatchNotification(userId: string) {
  listeners.get(userId)?.forEach((callback) => callback());
}
async function listen() {
  if (client) return;
  if (connecting) return connecting;
  connecting = (async () => {
    const connection = await pool.connect();
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        connection.release(true);
      }
    };
    const failed = () => {
      if (client === connection) client = undefined;
      release();
    };
    connection.once("error", failed);
    try {
      await connection.query("LISTEN aplime_notifications");
      connection.on("notification", (msg) => {
        if (msg.channel === "aplime_notifications" && msg.payload)
          dispatchNotification(msg.payload);
      });
      client = connection;
    } catch (error) {
      connection.removeListener("error", failed);
      release();
      throw error;
    }
  })().finally(() => {
    connecting = undefined;
  });
  return connecting;
}
export async function notificationStream(req: Request, res: Response) {
  if ((listeners.get(req.account.id)?.size || 0) >= 10) {
    res
      .status(429)
      .json({ error: "Too many live connections. Close an unused tab." });
    return;
  }
  await listen();
  if (res.destroyed) return;
  if ((listeners.get(req.account.id)?.size || 0) >= 10) {
    res
      .status(429)
      .json({ error: "Too many live connections. Close an unused tab." });
    return;
  }
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const send = () => {
    if (!res.destroyed && !res.write("data: changed\n\n")) res.end();
  };
  const unsubscribe = subscribeNotifications(req.account.id, send);
  const heartbeat = setInterval(() => {
    if (!res.destroyed) res.write(": heartbeat\n\n");
  }, 15000);
  // Rotate the connection so normal Firebase revocation/role checks run again.
  const expiry = setTimeout(() => res.end(), 55000);
  res.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(expiry);
  });
  send(); // Refresh after subscribing; events missed while disconnected remain in the database.
}
export function closeNotificationStream() {
  if (client) {
    client.release(true);
    client = undefined;
  }
}
