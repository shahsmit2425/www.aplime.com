import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
process.env.STRIPE_SECRET_KEY = "sk_test_email_fixture";
process.env.STRIPE_PRO_PRICE_ID = "price_email_fixture";
process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = "whsec_email_fixture";
const { pool, transaction } = await import("../src/server/db/index.js");
const { notify, notifyMany } = await import("../src/server/repository.js");
const { deliverOutbox } = await import("../src/server/outbox.js");
const { queueEmailReminders, reminderStillRelevant } =
  await import("../src/server/email-reminders.js");
const { adminConsole } = await import("../src/server/admin-console.js");
const { webhooks } = await import("../src/server/webhooks.js");
const { stripe } = await import("../src/server/integrations/stripe.js");
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
for (const [id, role] of [
  ["email-customer", "customer"],
  ["email-pro", "pro"],
  ["email-off", "customer"],
  ["email-admin", "admin"],
])
  await query(
    "INSERT INTO users(id,name,email,role,settings) VALUES($1,$1,$2,$3,$4)",
    [
      id,
      id + "@example.invalid",
      role,
      JSON.stringify(id === "email-off" ? { emailAlerts: false } : {}),
    ],
  );
await query(
  "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status) VALUES('email-pro','Business','Cleaning','Business description','08859',50,true,'approved')",
);
test.after(async () => {
  await db.close();
  await pool.end();
});
test("bulk event emails respect categories, group unread messages and skip read messages", async () => {
  await transaction(async (c) => {
    await notifyMany(
      c,
      ["email-customer", "email-off", "email-customer"],
      "Project published",
      "Project ready",
      { page: "dashboard" },
    );
    await notify(c, "email-customer", "Preferences updated", "Saved", {
      page: "availability",
    });
  });
  assert.equal(
    (await query("SELECT count(*)::int n FROM email_outbox")).rows[0].n,
    1,
  );
  const thread = randomUUID();
  for (let i = 0; i < 3; i++)
    await transaction((c) =>
      notify(c, "email-customer", "New message", "Open Messages to reply.", {
        page: "messages",
        id: thread,
      }),
    );
  const grouped = (
    await query("SELECT * FROM email_outbox WHERE category='messages'")
  ).rows;
  assert.equal(grouped.length, 1);
  assert.ok(
    new Date(grouped[0].next_attempt_at).getTime() > Date.now() + 60000,
  );
  await query("UPDATE notifications SET read=true WHERE target_id=$1", [
    thread,
  ]);
  await query("UPDATE email_outbox SET next_attempt_at=now()");
  const sent: any[] = [];
  await deliverOutbox(async (...args) => sent.push(args));
  assert.equal(sent.length, 1);
  assert.ok(sent[0][2].includes("/app/dashboard"));
  assert.ok(sent[0][3].includes("<!doctype html>"));
  assert.ok(sent[0][4].includes("aplime."));
  assert.ok(
    (
      await query(
        "SELECT cancelled_at FROM email_outbox WHERE category='messages'",
      )
    ).rows[0].cancelled_at,
  );
  await query("UPDATE users SET settings=$2 WHERE id=$1", [
    "email-customer",
    JSON.stringify({ emailCategories: { projects: false } }),
  ]);
  await transaction((c) =>
    notify(c, "email-customer", "Project paused", "Paused", {
      page: "project",
    }),
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM email_outbox WHERE subject='Project paused'",
      )
    ).rows[0].n,
    0,
  );
  await transaction((c) =>
    notify(c, "email-off", "New message from Aplime support", "Open support", {
      page: "messages",
      id: "support:" + randomUUID(),
    }),
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM email_outbox WHERE user_id='email-off'",
      )
    ).rows[0].n,
    1,
  );
  await query("UPDATE users SET settings='{}' WHERE id='email-customer'");
});
test("scheduled reminders deduplicate and stale meeting/estimate/visit alerts stop being relevant", async () => {
  const p = randomUUID(),
    call = randomUUID(),
    visit = randomUUID(),
    q = randomUUID();
  for (const id of [p, visit])
    await query(
      "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,status) VALUES($1,'email-customer','email-pro','Cleaning','Details','Cleaning','08859',$2)",
      [id, id === p ? "requested" : "booked"],
    );
  await query(
    "UPDATE projects SET scheduled_at=now()+interval '2 hours' WHERE id=$1",
    [visit],
  );
  await query(
    "INSERT INTO scheduled_calls(id,project_id,customer_id,pro_id,starts_at,mode,status) VALUES($1,$2,'email-customer','email-pro',now()+interval '5 minutes','video','confirmed')",
    [call, p],
  );
  await query(
    "INSERT INTO quotes(id,project_id,pro_id,amount,description,expires_at) VALUES($1,$2,'email-pro',5000,'Scope',now()+interval '2 hours')",
    [q, p],
  );
  await queueEmailReminders();
  await queueEmailReminders();
  assert.equal(
    (await query("SELECT count(*)::int n FROM alert_event_receipts")).rows[0].n,
    5,
  );
  for (const row of (
    await query(
      "SELECT event_key FROM email_outbox WHERE event_key IS NOT NULL",
    )
  ).rows)
    assert.equal(await reminderStillRelevant(row.event_key, pool), true);
  await query(
    "UPDATE scheduled_calls SET status='requested',starts_at=now()-interval '1 hour',proposed_at=now()-interval '1 hour',proposed_by=customer_id,updated_at=now()-interval '2 days' WHERE id=$1",
    [call],
  );
  await query("UPDATE quotes SET status='withdrawn' WHERE id=$1", [q]);
  await query(
    "UPDATE projects SET scheduled_at=now()+interval '3 hours' WHERE id=$1",
    [visit],
  );
  for (const row of (
    await query(
      "SELECT event_key FROM email_outbox WHERE event_key IS NOT NULL",
    )
  ).rows)
    assert.equal(await reminderStillRelevant(row.event_key, pool), false);
  await queueEmailReminders();
  await queueEmailReminders();
  assert.equal(
    (await query("SELECT count(*)::int n FROM alert_event_receipts")).rows[0].n,
    8,
  );
  assert.equal(
    (await query("SELECT status FROM scheduled_calls WHERE id=$1", [call]))
      .rows[0].status,
    "requested",
  );
});
test("admin delivery controls reject non-admins, retry only failed mail and audit changes", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.account = {
      id: req.headers["x-role"] === "admin" ? "email-admin" : "email-customer",
      role: req.headers["x-role"] === "admin" ? "admin" : "customer",
      name: "Fixture",
      email: "fixture@example.invalid",
      settings: {},
    };
    next();
  });
  app.use(adminConsole);
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e.status || (e.name === "ZodError" ? 400 : 500))
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const send = (path: string, body?: unknown, admin = true) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "x-role": admin ? "admin" : "customer",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await send("/email-alerts", undefined, false)).status, 403);
    const result = await (await send("/email-alerts")).json();
    assert.ok(result.rows.length);
    assert.ok(result.preview.html.includes("Aplime"));
    assert.equal(
      (
        await send("/email-alerts/settings", {
          category: "security",
          enabled: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("/email-alerts/settings", {
          category: "projects",
          enabled: false,
        })
      ).status,
      200,
    );
    const id = randomUUID();
    await query(
      "INSERT INTO email_outbox(id,user_id,subject,body,attempts) VALUES($1,'email-customer','Delivery failed','Body',8)",
      [id],
    );
    assert.equal((await send(`/email-alerts/${id}/retry`, {})).status, 200);
    assert.equal((await send(`/email-alerts/${id}/retry`, {})).status, 409);
    assert.equal(
      (await query("SELECT attempts FROM email_outbox WHERE id=$1", [id]))
        .rows[0].attempts,
      0,
    );
    const sent: string[] = [];
    await deliverOutbox(async (_to, subject) => {
      sent.push(subject);
    });
    assert.ok(!sent.includes("Delivery failed"));
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM audit_log WHERE action='retry_email_delivery'",
        )
      ).rows[0].n,
      1,
    );
    await query("UPDATE email_category_settings SET enabled=true");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test("signed membership invoice events are customer-scoped, deduplicated and ignore stale failures", async () => {
  await query(
    "INSERT INTO professional_subscriptions(user_id,customer_id,subscription_id) VALUES('email-pro','cus_email','sub_email')",
  );
  const subGet = stripe().subscriptions.retrieve,
    invoiceGet = stripe().invoices.retrieve;
  let invoiceStatus = "open";
  stripe().subscriptions.retrieve = (async () => ({
    id: "sub_email",
    customer: "cus_email",
    status: "active",
    items: {
      data: [
        {
          quantity: 1,
          price: {
            id: "price_email_fixture",
            type: "recurring",
            currency: "usd",
            livemode: false,
            unit_amount: 4000,
            recurring: {
              interval: "month",
              interval_count: 1,
              usage_type: "licensed",
            },
          },
        },
      ],
    },
  })) as any;
  stripe().invoices.retrieve = (async () => ({
    id: "in_email",
    status: invoiceStatus,
  })) as any;
  const app = express();
  app.use(webhooks);
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e.status || (e.name === "ZodError" ? 400 : 500))
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const send = (
    eventId: string,
    type: string,
    customer = "cus_email",
    invoice = "in_email",
  ) => {
    const payload = JSON.stringify({
      id: eventId,
      type,
      data: {
        object: {
          id: invoice,
          customer,
          parent: { subscription_details: { subscription: "sub_email" } },
        },
      },
    });
    return fetch(base + "/stripe-subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": stripe().webhooks.generateTestHeaderString({
          payload,
          secret: "whsec_email_fixture",
        }),
      },
      body: payload,
    });
  };
  try {
    const event = randomUUID();
    assert.equal((await send(event, "invoice.payment_failed")).status, 200);
    assert.equal((await send(event, "invoice.payment_failed")).status, 200);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM email_outbox WHERE subject='Membership payment failed'",
        )
      ).rows[0].n,
      1,
    );
    invoiceStatus = "paid";
    assert.equal(
      (
        await send(
          randomUUID(),
          "invoice.payment_failed",
          "cus_email",
          "in_old",
        )
      ).status,
      200,
    );
    assert.equal(
      (await send(randomUUID(), "invoice.paid", "cus_other")).status,
      200,
    );
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM email_outbox WHERE subject='Membership payment received'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal((await send(randomUUID(), "invoice.paid")).status, 200);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM email_outbox WHERE subject='Membership payment received'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    stripe().subscriptions.retrieve = subGet;
    stripe().invoices.retrieve = invoiceGet;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("deletion confirmation uses a short-lived address and removes it after sending", async () => {
  const { deleteAccountData } = await import("../src/server/account-data.js");
  const id = "delete-email-" + randomUUID(),
    address = id + "@example.invalid";
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Delete fixture',$2,'customer')",
    [id, address],
  );
  await deleteAccountData(id);
  assert.ok(
    (await query("SELECT deleted_at FROM users WHERE id=$1", [id])).rows[0]
      .deleted_at,
  );
  const mails: any[] = [];
  await deliverOutbox(async (...args) => {
    mails.push(args);
  }, 100);
  const confirmation = mails.find((m) => m[0] === address);
  assert.equal(confirmation?.[1], "Account deleted");
  assert.ok(!confirmation[3].includes("View update"));
  assert.ok(!confirmation[3].includes("Administration"));
  const job = (await query("SELECT * FROM email_outbox WHERE user_id=$1", [id]))
    .rows[0];
  assert.ok(job.sent_at);
  assert.equal(job.recipient_email, null);
  await query(
    "INSERT INTO email_outbox(id,user_id,subject,body,essential,category,recipient_email,created_at) VALUES(gen_random_uuid(),$1,'Account deleted','Deleted',true,'security',$2,now()-interval '8 days')",
    [id, address],
  );
  const expired: any[] = [];
  await deliverOutbox(async (...args) => {
    expired.push(args);
  }, 100);
  assert.ok(!expired.some((m) => m[0] === address));
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM email_outbox WHERE recipient_email IS NOT NULL AND user_id=$1",
        [id],
      )
    ).rows[0].n,
    0,
  );
});

test("exhausted email retries notify admins in-app without recursively queuing email", async () => {
  await query("DELETE FROM email_outbox");
  const id = randomUUID();
  await query(
    "INSERT INTO email_outbox(id,user_id,subject,body,attempts) VALUES($1,'email-customer','Test failure','Body',7)",
    [id],
  );
  await deliverOutbox(async () => {
    throw new Error("Email provider unavailable");
  });
  assert.equal(
    (await query("SELECT attempts FROM email_outbox WHERE id=$1", [id])).rows[0]
      .attempts,
    8,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM notifications WHERE user_id='email-admin' AND title='Email delivery failed'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM email_outbox")).rows[0].n,
    1,
  );
  assert.equal(await deliverOutbox(async () => {}), 0);
});

test("Resend cutover preserves queued records, retries rejected sends and marks only accepted mail sent", async (t) => {
  const { env } = await import("../src/server/config.js");
  const { sendEmail } = await import("../src/server/integrations/email.js");
  const originalFetch = globalThis.fetch;
  const oldKey = env.RESEND_API_KEY,
    oldFrom = env.EMAIL_FROM;
  env.RESEND_API_KEY = "re_cutover_fixture";
  env.EMAIL_FROM = "notification@example.invalid";
  t.after(() => {
    globalThis.fetch = originalFetch;
    env.RESEND_API_KEY = oldKey;
    env.EMAIL_FROM = oldFrom;
  });
  await query("DELETE FROM email_outbox");
  await query("UPDATE email_category_settings SET enabled=true");
  await query("UPDATE users SET settings='{}' WHERE id='email-customer'");
  const id = randomUUID();
  await query(
    "INSERT INTO email_outbox(id,user_id,subject,body) VALUES($1,'email-customer','New service opportunity','Cleaning request in ZIP 08859.')",
    [id],
  );
  const keys: string[] = [];
  let accepted = false;
  globalThis.fetch = (async (_url, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
    return accepted
      ? Response.json({ id: "provider-accepted" })
      : Response.json(
          {
            name: "rate_limit_exceeded",
            message: "Do not log private provider details",
          },
          { status: 429 },
        );
  }) as typeof fetch;
  await deliverOutbox(sendEmail);
  let row = (await query("SELECT * FROM email_outbox WHERE id=$1", [id]))
    .rows[0];
  assert.equal(row.attempts, 1);
  assert.equal(row.sent_at, null);
  assert.ok(new Date(row.next_attempt_at).getTime() > Date.now());
  accepted = true;
  await query("UPDATE email_outbox SET next_attempt_at=now() WHERE id=$1", [
    id,
  ]);
  await deliverOutbox(sendEmail);
  row = (await query("SELECT * FROM email_outbox WHERE id=$1", [id])).rows[0];
  assert.equal(row.attempts, 2);
  assert.ok(row.sent_at);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  assert.equal(await deliverOutbox(sendEmail), 0);
  assert.equal(keys.length, 2);
});
