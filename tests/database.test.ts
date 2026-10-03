import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
process.env.STRIPE_PRO_PRICE_ID = "price_test_pro";
process.env.STRIPE_SECRET_KEY = "sk_test_unit_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_fixture";
const { pool } = await import("../src/server/db/index.js");
const { projectAction } = await import("../src/server/projects.js");
const { workspace } = await import("../src/server/repository.js");
const { stripe } = await import("../src/server/integrations/stripe.js");
const { webhooks } = await import("../src/server/webhooks.js");
const db = new PGlite();
const query = async (text: string, values?: unknown[]) => {
  const result = await db.query(text, values);
  return { ...result, rowCount: result.affectedRows || result.rows.length };
};
pool.query = query as typeof pool.query;
pool.connect = (async () => ({
  query,
  release() {},
})) as unknown as typeof pool.connect;
const customer = {
  id: "customer-" + randomUUID(),
  name: "Test customer",
  email: "customer@example.invalid",
  role: "customer" as const,
  settings: {},
};
const professional = {
  id: "professional-" + randomUUID(),
  name: "Test professional",
  email: "pro@example.invalid",
  role: "pro" as const,
  settings: {},
};
const outsider = {
  id: "outsider-" + randomUUID(),
  name: "Other customer",
  email: "other@example.invalid",
  role: "customer" as const,
  settings: {},
};
await db.exec(
  await readFile("src/server/db/migrations/001_marketplace.sql", "utf8"),
);
await db.exec(
  await readFile("src/server/db/migrations/002_project_intake.sql", "utf8"),
);
await db.exec(
  await readFile(
    "src/server/db/migrations/003_business_subscriptions.sql",
    "utf8",
  ),
);
test.after(async () => {
  await db.close();
  await pool.end();
});
test("schema starts empty, with no seeded accounts or marketplace data", async () => {
  const result = await query("SELECT count(*)::int AS n FROM users");
  assert.equal((result.rows[0] as any).n, 0);
});
test("real PostgreSQL engine enforces ownership workflow and duplicate constraints", async () => {
  for (const u of [customer, professional, outsider])
    await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
      u.id,
      u.name,
      u.email,
      u.role,
    ]);
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified) VALUES($1,$2,$3,$4,$5,$6,true)",
    [
      professional.id,
      "Test business",
      "Handyman",
      "Detailed professional description",
      "10001",
      50,
    ],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [professional.id],
  );
  const membership = await query(
    "SELECT status FROM professional_subscriptions WHERE user_id=$1",
    [professional.id],
  );
  assert.equal((membership.rows[0] as any).status, "active");
  const id = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      customer.id,
      "Test project",
      "Detailed scope for the test",
      "Handyman",
      "10001",
    ],
  );
  await projectAction(id, professional, {
    type: "quote",
    amount: 15000,
    description: "Labor and materials included.",
  });
  const quote = (await query("SELECT * FROM quotes WHERE project_id=$1", [id]))
    .rows[0] as any;
  await assert.rejects(
    projectAction(id, professional, {
      type: "quote",
      amount: 1,
      description: "Repeated estimate",
    }),
  );
  await assert.rejects(
    projectAction(id, outsider, { type: "accept", quoteId: quote.id }),
  );
  await projectAction(id, customer, { type: "accept", quoteId: quote.id });
  await assert.rejects(projectAction(id, customer, { type: "start" }));
  await projectAction(id, professional, { type: "start" });
  await projectAction(id, professional, { type: "complete" });
  await assert.rejects(projectAction(id, professional, { type: "complete" }));
  await query(
    "INSERT INTO payments(id,project_id,amount,status,checkout_id) VALUES($1,$2,15000,'pending','cs_test_checkout')",
    [randomUUID(), id],
  );
  await assert.rejects(
    query("INSERT INTO payments(id,project_id,amount) VALUES($1,$2,15000)", [
      randomUUID(),
      id,
    ]),
  );
  const owner = await workspace(customer),
    other = await workspace(outsider);
  assert.equal(owner.projects.length, 1);
  assert.equal(other.projects.length, 0);
  assert.equal(other.payments.length, 0);
  assert.equal(other.messages.length, 0);
  await projectAction(id, customer, {
    type: "dispute",
    reason: "A test support case with details.",
  });
  const disputed = (
    await query("SELECT status,previous_status FROM projects WHERE id=$1", [id])
  ).rows[0] as any;
  assert.equal(disputed.status, "disputed");
  assert.equal(disputed.previous_status, "completed");
});
test("unsigned webhooks are rejected and duplicate signed events are idempotent", async () => {
  const express = (await import("express")).default;
  const app = express();
  app.use("/webhooks", webhooks);
  app.use((err: any, _q: any, r: any, _n: any) =>
    r.status(err.status || 500).json({ error: "rejected" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" + (server.address() as any).port + "/webhooks/stripe";
  try {
    const event = {
      id: "evt_unit_" + randomUUID(),
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_checkout",
          payment_status: "paid",
          amount_total: 15000,
          currency: "usd",
          payment_intent: "pi_test_unit",
        },
      },
    };
    const body = JSON.stringify(event);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
      ).status,
      400,
    );
    const signature = stripe().webhooks.generateTestHeaderString({
      payload: body,
      secret: "whsec_unit_fixture",
    });
    for (let n = 0; n < 2; n++)
      assert.equal(
        (
          await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "stripe-signature": signature,
            },
            body,
          })
        ).status,
        200,
      );
    assert.equal(
      (
        (
          await query(
            "SELECT count(*)::int AS n FROM webhook_events WHERE id=$1",
            [event.id],
          )
        ).rows[0] as any
      ).n,
      1,
    );
    assert.equal(
      (
        (
          await query(
            "SELECT status FROM payments WHERE checkout_id='cs_test_checkout'",
          )
        ).rows[0] as any
      ).status,
      "paid",
    );
    const forged = {
      id: "evt_identity_" + randomUUID(),
      type: "identity.verification_session.verified",
      data: {
        object: { id: "vs_not_stored", metadata: { userId: professional.id } },
      },
    };
    await query("UPDATE profiles SET verified=false WHERE id=$1", [
      professional.id,
    ]);
    const raw = JSON.stringify(forged),
      sig = stripe().webhooks.generateTestHeaderString({
        payload: raw,
        secret: "whsec_unit_fixture",
      });
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": sig },
      body: raw,
    });
    assert.equal(
      (
        (
          await query("SELECT verified FROM profiles WHERE id=$1", [
            professional.id,
          ])
        ).rows[0] as any
      ).verified,
      false,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("subscription webhooks use current Stripe state and match stored customers", async () => {
  const original = stripe().subscriptions.retrieve;
  let currentStatus = "active";
  stripe().subscriptions.retrieve = (async () => ({
    id: "sub_test_pro",
    status: currentStatus,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_test_pro" } }] },
  })) as any;
  await query(
    "UPDATE professional_subscriptions SET customer_id='cus_test_pro' WHERE user_id=$1",
    [professional.id],
  );
  const app = (await import("express")).default();
  app.use("/webhooks", webhooks);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    for (const status of ["active", "past_due", "canceled"]) {
      currentStatus = status;
      const body = JSON.stringify({
        id: "evt_" + randomUUID(),
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test_pro",
            customer: "cus_test_pro",
            status: "active",
          },
        },
      });
      const signature = stripe().webhooks.generateTestHeaderString({
        payload: body,
        secret: "whsec_unit_fixture",
      });
      const response = await fetch(
        "http://127.0.0.1:" +
          (server.address() as any).port +
          "/webhooks/stripe",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          body,
        },
      );
      assert.equal(response.status, 200);
      assert.equal(
        (
          (
            await query(
              "SELECT status FROM professional_subscriptions WHERE user_id=$1",
              [professional.id],
            )
          ).rows[0] as { status: string }
        ).status,
        status,
      );
    }
  } finally {
    stripe().subscriptions.retrieve = original;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("project image reservations count pending files and reject the sixth image", async () => {
  const { reserveUpload } = await import("../src/server/uploads.js");
  const projectId = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,$3,$4,$5,$6)",
    [
      projectId,
      customer.id,
      "Photo limit test",
      "A project for testing image limits",
      "Handyman",
      "10001",
    ],
  );
  for (let index = 0; index < 5; index++) {
    const id = randomUUID();
    await reserveUpload(id, projectId, customer.id, id, {
      name: "photo.jpg",
      contentType: "image/jpeg",
      size: 100,
    });
  }
  await assert.rejects(
    () =>
      reserveUpload(randomUUID(), projectId, customer.id, randomUUID(), {
        name: "sixth.png",
        contentType: "image/png",
        size: 100,
      }),
    /up to 5 images/,
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM uploads WHERE project_id=$1",
        [projectId],
      )
    ).rows[0].n,
    5,
  );
  const docId = randomUUID();
  await reserveUpload(docId, projectId, customer.id, docId, {
    name: "specification.pdf",
    contentType: "application/pdf",
    size: 100,
  });
});
