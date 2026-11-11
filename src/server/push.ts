import { reportWorkerFailure } from "./worker-monitor.js";
import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "./db/index.js";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { firebaseApp } from "./integrations/firebase.js";

export const pushRouter = Router();
const tokenSchema = z.string().min(20).max(4096).regex(/^\S+$/);
pushRouter.post("/devices", async (req, res) => {
  const { token, platform } = z
    .object({ token: tokenSchema, platform: z.enum(["ios", "android"]) })
    .parse(req.body);
  await transaction(async (c) => {
    // Serialize registrations for this user and bound the number of destinations.
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      req.account.id,
    ]);
    await c.query(
      `INSERT INTO push_devices(token,user_id,platform) VALUES($1,$2,$3)
      ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,
      registered_at=CASE WHEN push_devices.user_id<>EXCLUDED.user_id OR push_devices.registered_at <=
      (SELECT sessions_revoked_at FROM users WHERE id=$2) THEN now() ELSE push_devices.registered_at END,updated_at=now()`,
      [token, req.account.id, platform],
    );
    await c.query(
      `DELETE FROM push_devices WHERE user_id=$1 AND token IN
      (SELECT token FROM push_devices WHERE user_id=$1 ORDER BY updated_at DESC OFFSET 10)`,
      [req.account.id],
    );
  });
  res.json({ ok: true });
});
pushRouter.post("/devices/remove", async (req, res) => {
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  await pool.query("DELETE FROM push_devices WHERE token=$1 AND user_id=$2", [
    token,
    req.account.id,
  ]);
  res.json({ ok: true });
});
pushRouter.get("/notifications/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(
    "SELECT target_page, target_id FROM notifications WHERE id=$1 AND user_id=$2",
    [id, req.account.id],
  );
  if (!result.rows.length) {
    res.status(404).json({ error: "Notification unavailable." });
    return;
  }
  res.json(result.rows[0]);
});

export function pushMessage(token: string, notificationId: string): Message {
  return {
    token,
    notification: {
      title: "Aplime",
      body: "You have a new update. Open Aplime to view it.",
    },
    data: { notificationId },
    apns: {
      headers: {
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": notificationId,
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
      },
      payload: { aps: { sound: "default" } },
    },
    android: {
      priority: "high",
      ttl: 3600000,
      notification: { tag: notificationId },
    },
  };
}
export async function deliverPush(
  send: (message: Message) => Promise<string> = (message) =>
    getMessaging(firebaseApp()).send(message),
) {
  let processed = 0;
  for (let i = 0; i < 20; i++) {
    const found = await transaction(async (c) => {
      const row = (
        await c.query(`SELECT p.*, n.read, d.user_id AS device_user, d.registered_at, u.deleted_at,
        u.sessions_revoked_at FROM push_deliveries p JOIN notifications n ON n.id=p.notification_id
        JOIN push_devices d ON d.token=p.token JOIN users u ON u.id=p.user_id
        WHERE p.status='pending' AND p.next_attempt_at<=now() ORDER BY p.id
        LIMIT 1 FOR UPDATE OF p SKIP LOCKED`)
      ).rows[0];
      if (!row) return false;
      if (
        row.read ||
        row.deleted_at ||
        row.device_user !== row.user_id ||
        new Date(row.registered_at) > new Date(row.created_at) ||
        (row.sessions_revoked_at &&
          new Date(row.sessions_revoked_at) > new Date(row.registered_at)) ||
        Date.now() - new Date(row.created_at).getTime() > 3600000
      ) {
        await c.query(
          "UPDATE push_deliveries SET status='skipped' WHERE id=$1",
          [row.id],
        );
        return true;
      }
      try {
        await send(pushMessage(row.token, row.notification_id));
        await c.query(
          "UPDATE push_deliveries SET status='sent',attempts=attempts+1,last_error=NULL WHERE id=$1",
          [row.id],
        );
      } catch (error) {
        const code = String(
          (error as { code?: string }).code || "delivery-failed",
        );
        if (
          [
            "messaging/registration-token-not-registered",
            "messaging/invalid-registration-token",
          ].includes(code)
        ) {
          await c.query(
            "DELETE FROM push_devices WHERE token=$1 AND user_id=$2",
            [row.token, row.user_id],
          );
        } else {
          const attempts = row.attempts + 1;
          await c.query(
            `UPDATE push_deliveries SET attempts=$2,status=$3,last_error=$4,
            next_attempt_at=now()+($5 * interval '1 second') WHERE id=$1`,
            [
              row.id,
              attempts,
              attempts >= 6 ? "failed" : "pending",
              /^messaging\/[a-z-]+$/.test(code) ? code : "delivery-failed",
              Math.min(900, 30 * 2 ** attempts),
            ],
          );
          if (attempts >= 6) reportWorkerFailure("push-delivery-exhausted");
          console.error(
            "Push delivery deferred",
            row.id,
            /^messaging\/[a-z-]+$/.test(code) ? code : "delivery-failed",
          );
        }
      }
      return true;
    });
    if (!found) break;
    processed++;
  }
  await pool.query(
    "DELETE FROM push_devices WHERE updated_at<now()-interval '60 days'",
  );
  await pool.query(
    "DELETE FROM push_deliveries WHERE status<>'pending' AND created_at<now()-interval '30 days'",
  );
  return processed;
}
