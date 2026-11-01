import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pool } from "../src/server/db/index.js";
import { deliverPush, pushMessage } from "../src/server/push.js";

test("push outbox queues only registered devices, retries, and isolates account changes", async () => {
  const db = new PGlite();
  const query = async (text: string, values?: unknown[]) => {
    const r = await db.query(text, values);
    return { ...r, rowCount: r.affectedRows || r.rows.length };
  };
  pool.query = query as typeof pool.query;
  pool.connect = (async () => ({
    query,
    release() {},
  })) as unknown as typeof pool.connect;
  try {
    await db.exec(`CREATE TABLE users(id text PRIMARY KEY,role text,deleted_at timestamptz,sessions_revoked_at timestamptz);
   CREATE TABLE notifications(id uuid PRIMARY KEY,user_id text REFERENCES users(id),read boolean DEFAULT false);
   INSERT INTO users(id,role) VALUES('customer','customer'),('other','pro'),('admin','admin');`);
    await db.exec(
      await readFile("src/server/db/migrations/029_mobile_push.sql", "utf8"),
    );
    const notice = async (user = "customer") => {
      const id = randomUUID();
      await query("INSERT INTO notifications(id,user_id) VALUES($1,$2)", [
        id,
        user,
      ]);
      return id;
    };
    await notice();
    assert.equal((await query("SELECT * FROM push_deliveries")).rows.length, 0);
    await query(
      "INSERT INTO push_devices(token,user_id,platform) VALUES('test-device','customer','ios'),('admin-device','admin','ios')",
    );
    await notice("admin");
    assert.equal((await query("SELECT * FROM push_deliveries")).rows.length, 0);
    const id = await notice();
    let sent = 0;
    await deliverPush(async (m) => {
      sent++;
      assert.deepEqual(m.data, {notificationId:id});
      assert.ok('token' in m && m.token === 'test-device');
      return "sent";
    });
    assert.equal(sent, 1);
    await deliverPush(async () => {
      sent++;
      return "unexpected";
    });
    assert.equal(sent, 1);
    const retry = await notice();
    await deliverPush(async () => {
      throw { code: "messaging/server-unavailable" };
    });
    let row = (
      await query("SELECT * FROM push_deliveries WHERE notification_id=$1", [
        retry,
      ])
    ).rows[0] as any;
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 1);
    await query(
      "UPDATE push_deliveries SET next_attempt_at=now()-interval '1 second' WHERE notification_id=$1",
      [retry],
    );
    await deliverPush(async () => "retried");
    row = (
      await query("SELECT * FROM push_deliveries WHERE notification_id=$1", [
        retry,
      ])
    ).rows[0] as any;
    assert.equal(row.status, "sent");
    const moved = await notice();
    await query(
      "UPDATE push_devices SET user_id='other' WHERE token='test-device'",
    );
    await deliverPush(async () => {
      assert.fail("must not send previous user notifications");
    });
    assert.equal(
      (
        (
          await query(
            "SELECT status FROM push_deliveries WHERE notification_id=$1",
            [moved],
          )
        ).rows[0] as any
      ).status,
      "skipped",
    );
    await query(
      "UPDATE push_devices SET user_id='customer' WHERE token='test-device'",
    );
    const read = await notice();
    await query("UPDATE notifications SET read=true WHERE id=$1", [read]);
    await deliverPush(async () => {
      assert.fail("already read");
    });
    const expired = await notice();
    await query(
      "UPDATE push_deliveries SET created_at=now()-interval '2 hours' WHERE notification_id=$1",
      [expired],
    );
    await deliverPush(async () => {
      assert.fail("expired");
    });
    await notice();
    await deliverPush(async () => {
      throw { code: "messaging/registration-token-not-registered" };
    });
    assert.equal(
      (await query("SELECT * FROM push_devices WHERE token='test-device'")).rows
        .length,
      0,
    );
    await query(
      "INSERT INTO push_devices(token,user_id,platform) VALUES('new-device','customer','ios')",
    );
    await notice();
    for (let attempt = 0; attempt < 6; attempt++) {
      await query(
        "UPDATE push_deliveries SET next_attempt_at=now()-interval '1 second' WHERE status='pending'",
      );
      await deliverPush(async () => {
        throw { code: "messaging/server-unavailable" };
      });
    }
    assert.equal(
      (
        (
          await query(
            "SELECT count(*)::int AS n FROM push_deliveries WHERE status='failed'",
          )
        ).rows[0] as any
      ).n,
      1,
    );
    await query(
      "UPDATE users SET sessions_revoked_at=now() WHERE id='customer'",
    );
    assert.equal(
      (await query("SELECT * FROM push_devices WHERE user_id='customer'")).rows
        .length,
      0,
    );
    assert.equal(
      JSON.stringify(pushMessage("token", "id")).includes("project"),
      false,
    );
  } finally {
    await db.close();
    await pool.end();
  }
});
