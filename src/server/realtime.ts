import { clientNetwork, type TrustProxy } from "./client-ip.js";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { redis, redisKey, redisChannel, startRedis } from "./redis.js";
import {
  dispatchNotification,
  subscribeNotifications,
  listenNotifications,
} from "./notification-stream.js";

export async function realtimeTicket(req: Request, res: Response) {
  if (!redis?.isReady) {
    res.status(503).json({ error: "Live connection unavailable" });
    return;
  }
  const ticket = randomBytes(32).toString("hex");
  await redis.set(redisKey(`ticket:${ticket}`), req.account.id, { EX: 20 });
  res.set("Cache-Control", "no-store").json({ ticket });
}
export function attachRealtime(
  server: Server,
  origins: Set<string>,
  trust?: TrustProxy,
) {
  let stopped = false;
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  });
  const connections = new Map<string, number>();
  const users = new Map<string, number>();
  const retryListener = setInterval(() => {
    void listenNotifications().catch(() => {});
  }, 10000);
  const subscriber = redis?.duplicate();
  subscriber?.on("error", () =>
    console.error("Live Redis subscription unavailable"),
  );
  void (async () => {
    await startRedis();
    if (stopped) return;
    await subscriber?.connect();
    if (stopped) {
      if (subscriber?.isOpen) subscriber.destroy();
      return;
    }
    await subscriber?.subscribe(redisChannel, dispatchNotification);
    await listenNotifications();
  })().catch(() => console.error("Live transport starting in fallback mode"));
  server.on("upgrade", (req, socket, head) => {
    if (
      req.url !== "/api/realtime" ||
      !req.headers.origin ||
      !origins.has(req.headers.origin) ||
      !redis?.isReady
    ) {
      socket.destroy();
      return;
    }
    const ip = clientNetwork(req, trust);
    if ((connections.get(ip) || 0) >= 30 || sockets.clients.size >= 5000) {
      socket.destroy();
      return;
    }
    connections.set(ip, (connections.get(ip) || 0) + 1);
    socket.once("close", () => {
      const left = (connections.get(ip) || 1) - 1;
      if (left) connections.set(ip, left);
      else connections.delete(ip);
    });
    sockets.handleUpgrade(req, socket, head, (ws) => {
      let unsubscribe: (() => void) | undefined;
      let connectedUser: string | undefined;
      const deadline = setTimeout(() => ws.terminate(), 5000);
      const expiry = setTimeout(
        () => ws.close(1000, "Refresh authorization"),
        55000,
      );
      const send = () => {
        if (ws.readyState === WebSocket.OPEN) {
          if (ws.bufferedAmount > 8192) ws.close(1013);
          else ws.send(JSON.stringify({ type: "changed" }));
        }
      };
      ws.once("message", (message) => {
        void (async () => {
          const { ticket } = JSON.parse(message.toString());
          if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket))
            throw new Error("Invalid ticket");
          const userId = await redis!.getDel(redisKey(`ticket:${ticket}`));
          if (!userId || ws.readyState !== WebSocket.OPEN)
            throw new Error("Expired ticket");
          if ((users.get(userId) || 0) >= 10)
            throw new Error("Too many connections");
          users.set(userId, (users.get(userId) || 0) + 1);
          connectedUser = userId;
          clearTimeout(deadline);
          unsubscribe = subscribeNotifications(userId, send);
          send();
        })().catch(() => ws.close(1008));
      });
      ws.on("error", () => ws.close());
      ws.on("close", () => {
        clearTimeout(deadline);
        clearTimeout(expiry);
        unsubscribe?.();
        if (connectedUser) {
          const left = (users.get(connectedUser) || 1) - 1;
          if (left) users.set(connectedUser, left);
          else users.delete(connectedUser);
        }
      });
    });
  });
  return () => {
    stopped = true;
    clearInterval(retryListener);
    for (const ws of sockets.clients) ws.close(1001);
    sockets.close();
    if (subscriber?.isOpen) subscriber.destroy();
    if (redis?.isOpen) redis.destroy();
  };
}
