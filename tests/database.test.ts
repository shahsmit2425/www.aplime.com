import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
process.env.STRIPE_PRO_PRICE_ID = "price_test_pro";
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_fixture";
process.env.STRIPE_SECRET_KEY = "sk_test_unit_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_fixture";
process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = "whsec_subscription_fixture";
process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = "whsec_identity_fixture";
process.env.MARKETPLACE_DISCOVERY_MODE = "matched";
process.env.MARKETPLACE_PREVIEW = "false";
// Workspace responses presign R2 image URLs; signing is offline, so fixture
// credentials are enough for tests.
process.env.R2_ACCOUNT_ID = "r2-test-account";
process.env.R2_ACCESS_KEY_ID = "r2-test-key";
process.env.R2_SECRET_ACCESS_KEY = "r2-test-secret";
process.env.R2_BUCKET = "r2-test-bucket";
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
await db.exec(
  await readFile(
    "src/server/db/migrations/004_project_collaboration.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile("src/server/db/migrations/005_live_notifications.sql", "utf8"),
);
await db.exec(
  await readFile("src/server/db/migrations/006_business_images.sql", "utf8"),
);
await db.exec(
  await readFile(
    "src/server/db/migrations/007_marketplace_quality.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "src/server/db/migrations/008_matching_preferences_and_addresses.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile("src/server/db/migrations/009_project_lifecycle.sql", "utf8"),
);
await db.exec(
  await readFile(
    "src/server/db/migrations/010_award_handshake_and_expiry.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile("src/server/db/migrations/011_listed_profiles.sql", "utf8"),
);
await db.exec(
  await readFile("src/server/db/migrations/012_admin_support.sql", "utf8"),
);

test.after(async () => {
  await db.close();
  await pool.end();
});

async function lifecycleProject(status = "booked", assigned = true) {
  const id = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,status) VALUES($1,$2,$3,'Lifecycle project','Detailed scope for lifecycle checks','Handyman','10001',$4)",
    [id, customer.id, assigned ? professional.id : null, status],
  );
  return id;
}
async function projectRow(id: string) {
  return (await query("SELECT * FROM projects WHERE id=$1", [id]))
    .rows[0] as any;
}
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
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status) VALUES($1,$2,$3,$4,$5,$6,true,'approved')",
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
    laborAmount: 12000,
    materialsAmount: 3000,
    description: "Labor and materials included.",
    exclusions: "Permit fees",
    timeline: "One day",
    expiresAt: null,
  });
  const quote = (await query("SELECT * FROM quotes WHERE project_id=$1", [id]))
    .rows[0] as any;
  await projectAction(id, professional, {
    type: "quote",
    laborAmount: 12000,
    materialsAmount: 3000,
    description: "Updated labor and materials included.",
    exclusions: "Permit fees",
    timeline: "One day",
    expiresAt: null,
  });
  await assert.rejects(
    projectAction(id, customer, {
      type: "accept",
      quoteId: quote.id,
      revision: 1,
    }),
    /changed/,
  );
  await assert.rejects(
    projectAction(id, outsider, {
      type: "accept",
      quoteId: quote.id,
      revision: 2,
    }),
  );
  await projectAction(id, customer, {
    type: "accept",
    quoteId: quote.id,
    revision: 2,
  });
  await assert.rejects(
    projectAction(id, customer, { type: "start" }),
    /not available/,
  );
  await projectAction(id, professional, { type: "accept_award" });
  const visit = new Date(Date.now() + 86400000);
  visit.setUTCHours(14, 0, 0, 0);
  const proposedAt = visit.toISOString();
  await query(
    "UPDATE profiles SET weekly_hours=$2,time_zone='UTC' WHERE id=$1",
    [
      professional.id,
      JSON.stringify(
        Object.fromEntries(
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [
            day,
            { start: "08:00", end: "17:00" },
          ]),
        ),
      ),
    ],
  );

  await projectAction(id, customer, {
    type: "reschedule",
    scheduledAt: proposedAt,
  });
  await assert.rejects(
    projectAction(id, customer, {
      type: "respond_appointment",
      proposedAt,
      accept: true,
    }),
  );
  assert.equal(
    (
      await db.query<{ scheduled_at: string | null }>(
        "SELECT scheduled_at FROM projects WHERE id=$1",
        [id],
      )
    ).rows[0].scheduled_at,
    null,
  );
  await projectAction(id, professional, {
    type: "respond_appointment",
    proposedAt,
    accept: true,
  });
  await assert.rejects(
    projectAction(id, professional, {
      type: "respond_appointment",
      proposedAt,
      accept: true,
    }),
  );
  await projectAction(id, customer, { type: "start" });
  await assert.rejects(projectAction(id, professional, { type: "start" }));
  await projectAction(id, professional, { type: "complete" });
  await assert.rejects(projectAction(id, professional, { type: "complete" }));
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM projects WHERE id=$1",
        [id],
      )
    ).rows[0].status,
    "in_progress",
  );
  await assert.rejects(
    projectAction(id, professional, { type: "confirm_completion" }),
  );
  await projectAction(id, customer, { type: "confirm_completion" });
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
test("project preferences enforce category and location for feeds and estimates", async () => {
  const quote = {
    type: "quote" as const,
    laborAmount: 10000,
    materialsAmount: 0,
    description: "Detailed scope of repairs",
    exclusions: "",
    timeline: "One day",
    expiresAt: null,
  };
  for (const [category, zip, expected] of [
    ["Cleaning", "10001", false],
    ["Handyman", "90210", false],
    ["Handyman", "10001", true],
  ] as const) {
    const id = randomUUID();
    await query(
      "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        customer.id,
        "Preference test",
        "Detailed test scope",
        category,
        zip,
      ],
    );
    const feed = await workspace(professional);
    assert.equal(
      feed.leads.some((p) => p.id === id),
      expected,
    );
    if (expected) await projectAction(id, professional, quote);
    else await assert.rejects(projectAction(id, professional, quote));
  }
  const customerView = await workspace(customer);
  assert.ok(
    customerView.profiles.some(
      (p) => p.id === professional.id && p.matchedProjectIds?.length,
    ),
  );
  assert.equal(
    customerView.profiles.find((p) => p.id === professional.id)?.placeId,
    "",
  );
});
test("dedicated Stripe destinations reject wrong secrets and event families before recording events", async () => {
  const { env, requiredKeys } = await import("../src/server/config.js");
  const oldCombined = env.STRIPE_WEBHOOK_SECRET;
  const oldIdentity = env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  const express = (await import("express")).default;
  const app = express();
  app.use("/webhooks", webhooks);
  app.use((err: any, _q: any, r: any, _n: any) =>
    r.status(err.status || 500).json({ error: "rejected" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/webhooks";
  const send = (path: string, event: any, secret?: string) => {
    const payload = JSON.stringify(event);
    return fetch(base + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret
          ? {
              "stripe-signature": stripe().webhooks.generateTestHeaderString({
                payload,
                secret,
              }),
            }
          : {}),
      },
      body: payload,
    });
  };
  try {
    env.STRIPE_WEBHOOK_SECRET = "";
    const keys: readonly string[] = requiredKeys();
    assert.ok(keys.includes("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"));
    assert.ok(keys.includes("STRIPE_IDENTITY_WEBHOOK_SECRET"));
    assert.ok(!keys.includes("STRIPE_WEBHOOK_SECRET"));
    const identity = {
      id: "evt_split_" + randomUUID(),
      type: "identity.verification_session.verified",
      data: { object: { id: "vs_unowned_split" } },
    };
    const subscription = {
      id: "evt_split_" + randomUUID(),
      type: "customer.subscription.updated",
      data: {
        object: { id: "sub_unowned_split", customer: "cus_unowned_split" },
      },
    };
    assert.equal((await send("/stripe-identity", identity)).status, 400);
    assert.equal(
      (await send("/stripe-identity", identity, "whsec_subscription_fixture"))
        .status,
      400,
    );
    assert.equal(
      (
        await send(
          "/stripe-subscriptions",
          subscription,
          "whsec_identity_fixture",
        )
      ).status,
      400,
    );
    assert.equal(
      (await send("/stripe-identity", subscription, "whsec_identity_fixture"))
        .status,
      400,
    );
    assert.equal(
      (
        await send(
          "/stripe-subscriptions",
          identity,
          "whsec_subscription_fixture",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await query("SELECT id FROM webhook_events WHERE id=ANY($1)", [
          [identity.id, subscription.id],
        ])
      ).rowCount,
      0,
    );
    env.STRIPE_WEBHOOK_SECRET = oldCombined;
    env.STRIPE_IDENTITY_WEBHOOK_SECRET = "";
    // A configured legacy secret must never authorize a dedicated destination.
    assert.equal(
      (await send("/stripe-identity", identity, oldCombined)).status,
      503,
    );
    env.STRIPE_IDENTITY_WEBHOOK_SECRET = oldIdentity;
    for (let i = 0; i < 2; i++) {
      assert.equal(
        (await send("/stripe-identity", identity, "whsec_identity_fixture"))
          .status,
        200,
      );
      assert.equal(
        (
          await send(
            "/stripe-subscriptions",
            subscription,
            "whsec_subscription_fixture",
          )
        ).status,
        200,
      );
    }
    assert.equal(
      (
        await query("SELECT id FROM webhook_events WHERE id=ANY($1)", [
          [identity.id, subscription.id],
        ])
      ).rowCount,
      2,
    );
  } finally {
    env.STRIPE_WEBHOOK_SECRET = oldCombined;
    env.STRIPE_IDENTITY_WEBHOOK_SECRET = oldIdentity;
    await new Promise<void>((r) => server.close(() => r()));
  }
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
    items: {
      data: [
        {
          quantity: 1,
          price: {
            id: "price_test_pro",
            active: true,
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
        secret: "whsec_subscription_fixture",
      });
      const response = await fetch(
        "http://127.0.0.1:" +
          (server.address() as any).port +
          "/webhooks/stripe-subscriptions",
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

test("private discussions hide messages from outsiders and enforce blocking", async () => {
  const { default: express } = await import("express");
  const { discussions } = await import("../src/server/discussions.js");
  const thread = (
    await db.query<{ id: string }>(
      "SELECT d.id FROM project_discussions d JOIN projects p ON p.id=d.project_id WHERE p.status='disputed' LIMIT 1",
    )
  ).rows[0];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.account =
      req.headers["x-test-user"] === customer.id
        ? customer
        : req.headers["x-test-user"] === professional.id
          ? professional
          : outsider;
    next();
  });
  app.use(discussions);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const call = (path: string, user: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "x-test-user": user },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.deepEqual(
      await (await call("/discussions", outsider.id)).json(),
      [],
    );
    assert.equal(
      (
        await call(`/discussions/${thread.id}/messages`, outsider.id, {
          body: "Intrusion",
        })
      ).status,
      404,
    );
    // The existing fixture project is disputed; closed threads are read-only.
    assert.equal(
      (
        await call(`/discussions/${thread.id}/messages`, customer.id, {
          body: "Follow up",
        })
      ).status,
      409,
    );
    const rows = (await (
      await call("/discussions", customer.id)
    ).json()) as any[];
    assert.ok(rows.some((row) => row.id === thread.id));
    const openProjectId = randomUUID();
    await query(
      "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,$3,$4,$5,$6)",
      [
        openProjectId,
        customer.id,
        "Matched project conversation",
        "A matching handyman project for private questions.",
        "Handyman",
        "10001",
      ],
    );
    await query(
      "UPDATE professional_subscriptions SET status='active' WHERE user_id=$1",
      [professional.id],
    );
    await query(
      "UPDATE profiles SET verified=true,review_status='approved',suspended=false,available=true WHERE id=$1",
      [professional.id],
    );
    assert.equal(
      (
        await call(`/projects/${openProjectId}/discussions`, professional.id, {
          body: "Could you confirm the panel location and preferred timing?",
        })
      ).status,
      200,
    );
    const professionalThreads = (await (
      await call("/discussions", professional.id)
    ).json()) as any[];
    assert.ok(
      professionalThreads.some(
        (row) => row.project_id === openProjectId && row.messages.length === 1,
      ),
    );
    await db.query(
      "UPDATE projects SET status='booked' WHERE id=(SELECT project_id FROM project_discussions WHERE id=$1)",
      [thread.id],
    );
    assert.equal(
      (
        await call(`/discussions/${thread.id}/messages`, customer.id, {
          body: "Confirming access instructions",
        })
      ).status,
      200,
    );
    await db.query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
      customer.id,
      professional.id,
    ]);
    assert.equal(
      (
        await call(`/discussions/${thread.id}/messages`, professional.id, {
          body: "Blocked reply",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(`/discussions/${thread.id}/call`, professional.id, {
          audioOnly: true,
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("notification records and live events commit together, rollback stays silent", async () => {
  const { notify } = await import("../src/server/repository.js");
  const { transaction } = await import("../src/server/db/index.js");
  const events: string[] = [];
  const stop = await db.listen("aplime_notifications", (payload) =>
    events.push(payload),
  );
  try {
    await transaction(async (c) => {
      await notify(c, customer.id, "Live test", "A project changed.", {
        page: "project",
        id: "test-project",
      });
      assert.equal(events.length, 0);
    });
    assert.deepEqual(events, [customer.id]);
    const rows = await db.query<{ target_page: string; target_id: string }>(
      "SELECT target_page,target_id FROM notifications WHERE user_id=$1 AND title='Live test'",
      [customer.id],
    );
    assert.deepEqual(rows.rows[0], {
      target_page: "project",
      target_id: "test-project",
    });
    await assert.rejects(
      transaction(async (c) => {
        await notify(c, customer.id, "Rolled back", "Must not be delivered.");
        throw new Error("rollback");
      }),
    );
    assert.equal(events.length, 1);
    assert.equal(
      (await db.query("SELECT id FROM notifications WHERE title='Rolled back'"))
        .rows.length,
      0,
    );
    await db.query(
      "UPDATE notifications SET read=true WHERE user_id=$1 AND title='Live test'",
      [customer.id],
    );
    assert.equal(events.length, 2);
  } finally {
    await stop();
  }
});

test("business image slots preserve a published image while its replacement is pending", async () => {
  const ready = randomUUID(),
    pending = randomUUID();
  await db.query(
    "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size,status) VALUES($1::uuid,$2,'logo',$1::text,'logo.png','image/png',100,'ready')",
    [ready, professional.id],
  );
  await db.query(
    "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size) VALUES($1::uuid,$2,'logo',$1::text,'new-logo.png','image/png',100)",
    [pending, professional.id],
  );
  await assert.rejects(
    db.query(
      "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size) VALUES($1::uuid,$2,'logo',$1::text,'extra.png','image/png',100)",
      [randomUUID(), professional.id],
    ),
  );
  const { publicProfiles } = await import("../src/server/repository.js");
  await db.query(
    "UPDATE professional_subscriptions SET status='active' WHERE user_id=$1",
    [professional.id],
  );
  await db.query(
    "UPDATE profiles SET verified=true,suspended=false WHERE id=$1",
    [professional.id],
  );
  const profiles = await publicProfiles(professional.id);
  assert.equal(profiles[0].images?.length, 1);
  assert.equal(profiles[0].images?.[0].id, ready);
  assert.equal("key" in profiles[0].images![0], false);
  // Public image endpoint enforces listing eligibility without accessing storage for hidden profiles.
  const { default: express } = await import("express");
  const { publicBusinessImages, businessImages } =
    await import("../src/server/business-images.js");
  const app = express();
  app.use(express.json());
  app.use(publicBusinessImages);
  app.use((req, _res, next) => {
    req.account = outsider;
    next();
  });
  app.use("/profile/images", businessImages);
  app.use((e: any, _q: any, r: any, _n: any) =>
    r.status(e.status || 500).json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    assert.equal(
      (await fetch(base + "/profile/images/logo", { method: "DELETE" })).status,
      403,
    );
    await db.query("UPDATE profiles SET suspended=true WHERE id=$1", [
      professional.id,
    ]);
    assert.equal((await fetch(base + "/business-images/" + ready)).status, 404);
    assert.equal((await publicProfiles(professional.id)).length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("API image uploads enforce ownership and file limits and preserve saved images through failure and retry", async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const original = S3Client.prototype.send;
  const { businessImages } = await import("../src/server/business-images.js");
  const { errorResponse } = await import("../src/server/error-response.js");
  const express = (await import("express")).default;
  const owner = { ...professional, id: "upload-pro-" + randomUUID() };
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Image owner',$2,'pro')",
    [owner.id, owner.id + "@example.invalid"],
  );
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate) VALUES($1,'Image business','Handyman','Test image business','10001',50)",
    [owner.id],
  );
  const old = randomUUID();
  await query(
    "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size,status) VALUES($1,$2,'logo','old-logo','old.png','image/png',20,'ready')",
    [old, owner.id],
  );
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(12),
  ]);
  const stored = new Map<string, { body: Buffer; type: string }>();
  stored.set("old-logo", { body: bytes, type: "image/png" });
  let denyStorage = false,
    puts = 0;
  S3Client.prototype.send = (async (command: any) => {
    const input = command.input;
    if (command.constructor.name === "PutObjectCommand") {
      if (denyStorage)
        throw Object.assign(new Error("SECRET provider response"), {
          $metadata: { httpStatusCode: 403 },
        });
      puts++;
      stored.set(input.Key, { body: input.Body, type: input.ContentType });
      return {};
    }
    if (command.constructor.name === "DeleteObjectCommand") {
      stored.delete(input.Key);
      return {};
    }
    const object = stored.get(input.Key);
    if (!object) throw new Error("Missing test object");
    if (command.constructor.name === "HeadObjectCommand")
      return { ContentLength: object.body.length, ContentType: object.type };
    return {
      Body: { transformToByteArray: async () => object.body.subarray(0, 12) },
    };
  }) as typeof original;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.account =
      req.headers["x-actor"] === "other"
        ? professional
        : req.headers["x-actor"] === "customer"
          ? customer
          : owner;
    next();
  });
  app.use("/profile/images", businessImages);
  app.use((error: unknown, _req: any, res: any, _next: any) => {
    const output = errorResponse(error);
    res.status(output.status).json(output.body);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  try {
    const reserve = await fetch(base + "/profile/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: "logo",
        name: "new.png",
        size: bytes.length,
        contentType: "image/png",
        transport: "api",
      }),
    });
    assert.equal(reserve.status, 200);
    const item = await reserve.json();
    assert.equal(
      item.url,
      undefined,
      "API transport never exposes a presigned PUT",
    );
    assert.equal(item.uploadPath, "/profile/images/" + item.id + "/content");
    const put = (body: Buffer, actor = "owner", type = "image/png") =>
      fetch(base + item.uploadPath, {
        method: "PUT",
        headers: { "Content-Type": type, "x-actor": actor },
        body: new Uint8Array(body),
      });
    assert.equal((await put(bytes, "other")).status, 404);
    assert.equal((await put(bytes, "customer")).status, 403);
    assert.equal((await put(bytes, "owner", "image/svg+xml")).status, 415);
    assert.equal((await put(Buffer.alloc(20))).status, 400);
    assert.equal(
      (await put(Buffer.concat([bytes, Buffer.alloc(1)]))).status,
      400,
    );
    assert.equal((await put(Buffer.alloc(10485761))).status, 413);
    assert.equal(puts, 0);
    denyStorage = true;
    const failure = await put(bytes);
    assert.equal(failure.status, 503);
    const error = await failure.json();
    assert.equal(error.code, "STORAGE_CONFIGURATION_ERROR");
    assert.doesNotMatch(JSON.stringify(error), /SECRET/);
    assert.equal(
      (
        (
          await query(
            "SELECT id FROM business_images WHERE profile_id=$1 AND status='ready'",
            [owner.id],
          )
        ).rows[0] as { id: string } | undefined
      )?.id,
      old,
    );
    denyStorage = false;
    assert.equal((await put(bytes)).status, 200);
    assert.equal(puts, 1);
    assert.ok(stored.has("old-logo"), "old image remains until completion");
    const complete = () =>
      fetch(base + "/profile/images/" + item.id + "/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    assert.equal((await complete()).status, 200);
    assert.equal(
      (await complete()).status,
      200,
      "completion retries are idempotent",
    );
    assert.equal(stored.has("old-logo"), false);
    assert.equal(
      (await put(bytes)).status,
      404,
      "ready objects cannot be overwritten through the API upload route",
    );
    const remove = (imageId: string) =>
      fetch(base + "/profile/images/logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
    assert.equal((await remove(old)).status, 409);
    assert.equal((await remove(item.id)).status, 200);
    assert.equal(
      (
        await query("SELECT 1 FROM business_images WHERE profile_id=$1", [
          owner.id,
        ])
      ).rowCount,
      0,
    );
    const replacement = randomUUID();
    await query(
      "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size) VALUES($1::uuid,$2,'logo',$1::text,'later.png','image/png',20)",
      [replacement, owner.id],
    );
    assert.equal((await remove(item.id)).status, 200);
    assert.equal(
      (await query("SELECT 1 FROM business_images WHERE id=$1", [replacement]))
        .rowCount,
      1,
      "repeated delete does not discard another session's pending replacement",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    S3Client.prototype.send = original;
  }
});

test("development preview lists incomplete profiles and every open project without bypassing actions or production restrictions", async () => {
  const { env } = await import("../src/server/config.js");
  const { assertMatch } = await import("../src/server/matching.js");
  const { publicProfiles } = await import("../src/server/repository.js");
  const saved = {
    mode: env.MARKETPLACE_DISCOVERY_MODE,
    preview: env.MARKETPLACE_PREVIEW,
    app: env.APP_ENV,
  };
  const prefix = "preview-" + randomUUID();
  const owner = { ...customer, id: prefix + "-owner" };
  const pro = { ...professional, id: prefix + "-1" };
  const noProfile = { ...professional, id: prefix + "-new" };
  for (const u of [owner, noProfile])
    await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
      u.id,
      u.name,
      u.id + "@example.invalid",
      u.role,
    ]);
  await query(
    "INSERT INTO users(id,name,email,role) SELECT $1 || '-' || n,'Preview test business',$1 || '-' || n || '@example.invalid','pro' FROM generate_series(1,501) n",
    [prefix],
  );
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,available,address,place_id,review_note) SELECT $1 || '-' || n,'Preview business','Painting','A real test fixture description','90210',50,false,'Private street','private-place','Private admin note' FROM generate_series(1,501) n",
    [prefix],
  );
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip,address,place_id) SELECT gen_random_uuid(),$1,'Preview job','Test scope','Handyman','10001','Private customer street','private-place' FROM generate_series(1,101)",
    [owner.id],
  );
  const id = (
    (
      await query("SELECT id FROM projects WHERE customer_id=$1 LIMIT 1", [
        owner.id,
      ])
    ).rows[0] as { id: string }
  ).id;
  const c = await pool.connect();
  try {
    env.APP_ENV = "development";
    env.MARKETPLACE_DISCOVERY_MODE = "open";
    env.MARKETPLACE_PREVIEW = undefined;
    const view = await workspace(owner);
    assert.equal(view.marketplacePreview, true);
    const profiles = view.profiles.filter(
      (p) => p.id.startsWith(prefix) && p.discoverable,
    );
    assert.equal(profiles.length, 501);
    assert.ok(
      profiles.every(
        (p) => !p.canRespond && !p.verified && p.reviewStatus === "draft",
      ),
    );
    assert.ok(
      profiles.every(
        (p) => !p.address && !p.placeId && p.reviewNote === undefined,
      ),
    );
    assert.equal(
      (await publicProfiles(pro.id)).length,
      0,
      "preview is never published publicly",
    );
    for (const user of [pro, noProfile]) {
      const feed = await workspace(user);
      assert.equal(
        feed.leads.filter((p) => p.title === "Preview job").length,
        101,
      );
      assert.ok(feed.discoveryRequirements?.length);
      assert.ok(
        feed.leads.every((p) => !p.customerId && p.address === undefined),
      );
      await assert.rejects(assertMatch(c, user.id, id), { status: 403 });
      await assert.rejects(
        projectAction(id, user, {
          type: "quote",
          laborAmount: 100,
          materialsAmount: 0,
          description: "Test estimate",
          exclusions: "",
          timeline: "Next week",
          expiresAt: null,
        }),
        { status: 403 },
      );
    }
    await query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
      pro.id,
      owner.id,
    ]);
    assert.ok(
      !(await workspace(owner)).profiles.find((p) => p.id === pro.id)
        ?.discoverable,
    );
    assert.ok(!(await workspace(pro)).leads.some((p) => p.id === id));
    await query("DELETE FROM blocked WHERE user_id=$1", [pro.id]);
    await query("UPDATE profiles SET suspended=true WHERE id=$1", [pro.id]);
    assert.ok(
      !(await workspace(owner)).profiles.find((p) => p.id === pro.id)
        ?.discoverable,
    );
    assert.equal((await workspace(pro)).leads.length, 0);
    await query("UPDATE profiles SET suspended=false WHERE id=$1", [pro.id]);
    for (const status of ["paused", "completed", "cancelled", "booked"]) {
      await query("UPDATE projects SET status=$2 WHERE id=$1", [id, status]);
      assert.ok(!(await workspace(noProfile)).leads.some((p) => p.id === id));
    }
    for (const app of ["production", "stagging"] as const) {
      env.APP_ENV = app;
      env.MARKETPLACE_PREVIEW = "true";
      assert.equal((await workspace(owner)).marketplacePreview, false);
      assert.ok(
        !(await workspace(owner)).profiles.some(
          (p) => p.id.startsWith(prefix) && p.discoverable,
        ),
      );
      assert.equal((await workspace(noProfile)).leads.length, 0);
    }
    env.APP_ENV = "development";
    env.MARKETPLACE_PREVIEW = "false";
    assert.equal((await workspace(owner)).marketplacePreview, false);
    assert.ok(
      !(await workspace(owner)).profiles.some(
        (p) => p.id.startsWith(prefix) && p.discoverable,
      ),
    );
    env.MARKETPLACE_PREVIEW = "true";
    env.MARKETPLACE_DISCOVERY_MODE = "matched";
    assert.equal((await workspace(owner)).marketplacePreview, false);
  } finally {
    env.APP_ENV = saved.app;
    env.MARKETPLACE_DISCOVERY_MODE = saved.mode;
    env.MARKETPLACE_PREVIEW = saved.preview;
    c.release();
  }
});

test("open discovery crosses service and location preferences but keeps eligibility, privacy, blocking and lifecycle boundaries", async () => {
  const { env } = await import("../src/server/config.js");
  const { assertMatch } = await import("../src/server/matching.js");
  const { notifyMatchingProfessionals } =
    await import("../src/server/project-events.js");
  const mode = env.MARKETPLACE_DISCOVERY_MODE;
  const owner = { ...customer, id: "open-customer-" + randomUUID() };
  const pro = { ...professional, id: "open-pro-" + randomUUID() };
  const id = randomUUID();
  for (const u of [owner, pro])
    await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
      u.id,
      u.name,
      u.id + "@example.invalid",
      u.role,
    ]);
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,address,place_id) VALUES($1,'Open business','Painting','Experienced painting business','90210',50,true,'approved','Private business address','private-place')",
    [pro.id],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [pro.id],
  );
  const c = await pool.connect();
  try {
    env.MARKETPLACE_DISCOVERY_MODE = "open";
    const beforeProject = await workspace(owner);
    assert.equal(beforeProject.discoveryMode, "open");
    assert.ok(
      beforeProject.profiles.find((p) => p.id === pro.id)?.discoverable,
      "customers may browse before posting",
    );
    await query(
      "INSERT INTO projects(id,customer_id,title,description,category,zip,address,place_id) VALUES($1,$2,'Open repairs','Scope without private address','Handyman','10001','Private customer address','private-customer-place')",
      [id, owner.id],
    );
    const customerView = await workspace(owner);
    const listed = customerView.profiles.find((p) => p.id === pro.id)!;
    assert.ok(listed.discoverable);
    assert.equal(listed.address, "");
    assert.equal(listed.placeId, "");
    const project = (await workspace(pro)).leads.find((p) => p.id === id)!;
    assert.ok(project);
    assert.equal(project.customerId, null);
    assert.equal(project.address, undefined);
    assert.equal(project.placeId, undefined);
    assert.equal((project as any).latitude, undefined);
    await assertMatch(c, pro.id, id);
    await notifyMatchingProfessionals(c, id);
    assert.equal(
      (await query("SELECT 1 FROM notifications WHERE user_id=$1", [pro.id]))
        .rowCount,
      0,
      "broad browsing does not notify unrelated professionals",
    );
    await projectAction(id, pro, {
      type: "quote",
      laborAmount: 10000,
      materialsAmount: 0,
      description: "Can complete the requested work",
      exclusions: "",
      timeline: "Next week",
      expiresAt: null,
    });
    assert.equal(
      (
        await query("SELECT 1 FROM quotes WHERE project_id=$1 AND pro_id=$2", [
          id,
          pro.id,
        ])
      ).rowCount,
      1,
    );
    await projectAction(id, pro, {
      type: "withdraw_quote",
      reason: "No longer available for this request",
    });

    for (const [column, value, restored] of [
      ["verified", false, true],
      ["suspended", true, false],
      ["available", false, true],
      ["review_status", "pending", "approved"],
    ] as const) {
      await query(`UPDATE profiles SET ${column}=$2 WHERE id=$1`, [
        pro.id,
        value,
      ]);
      assert.ok(
        !(await workspace(owner)).profiles.find((p) => p.id === pro.id)
          ?.discoverable,
      );
      const view = await workspace(pro);
      assert.ok(!view.leads.some((p) => p.id === id));
      assert.ok(view.discoveryRequirements?.length);
      await assert.rejects(assertMatch(c, pro.id, id), { status: 403 });
      await query(`UPDATE profiles SET ${column}=$2 WHERE id=$1`, [
        pro.id,
        restored,
      ]);
    }
    await query(
      "UPDATE professional_subscriptions SET status='canceled' WHERE user_id=$1",
      [pro.id],
    );
    assert.ok(
      !(await workspace(owner)).profiles.find((p) => p.id === pro.id)
        ?.discoverable,
    );
    assert.ok(!(await workspace(pro)).leads.some((p) => p.id === id));
    await assert.rejects(assertMatch(c, pro.id, id), { status: 403 });
    await query(
      "UPDATE professional_subscriptions SET status='active' WHERE user_id=$1",
      [pro.id],
    );
    for (const [a, b] of [
      [owner.id, pro.id],
      [pro.id, owner.id],
    ]) {
      await query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
        a,
        b,
      ]);
      assert.ok(
        !(await workspace(owner)).profiles.find((p) => p.id === pro.id)
          ?.discoverable,
      );
      assert.ok(!(await workspace(pro)).leads.some((p) => p.id === id));
      await assert.rejects(assertMatch(c, pro.id, id), { status: 403 });
      await query("DELETE FROM blocked WHERE user_id=$1 AND other_id=$2", [
        a,
        b,
      ]);
    }
    for (const status of [
      "paused",
      "booked",
      "cancelled",
      "completed",
      "disputed",
    ]) {
      await query("UPDATE projects SET status=$2 WHERE id=$1", [id, status]);
      assert.ok(!(await workspace(pro)).leads.some((p) => p.id === id));
    }
    await query(
      "UPDATE projects SET status='requested',pro_id=$2 WHERE id=$1",
      [id, pro.id],
    );
    assert.ok(
      !(await workspace(pro)).leads.some((p) => p.id === id),
      "direct requests stay out of public leads",
    );
    await query("UPDATE projects SET pro_id=NULL WHERE id=$1", [id]);
    env.MARKETPLACE_DISCOVERY_MODE = "matched";
    assert.ok(!(await workspace(pro)).leads.some((p) => p.id === id));
    await assert.rejects(assertMatch(c, pro.id, id), { status: 403 });
  } finally {
    env.MARKETPLACE_DISCOVERY_MODE = mode;
    c.release();
  }
});

test("customer matches cap at five and enforce geographic radius and privacy", async () => {
  const customerId = "matching-customer-" + randomUUID();
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Matching customer',$2,'customer')",
    [customerId, customerId + "@example.invalid"],
  );
  const id = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip,latitude,longitude,address,place_id) VALUES($1,$2,'Local repairs','Detailed work','Handyman','10001',40.75,-73.99,'Private customer street','private-place')",
    [id, customerId],
  );
  const pros: string[] = [];
  for (let i = 0; i < 7; i++) {
    const proId = "matching-pro-" + randomUUID();
    pros.push(proId);
    await query(
      "INSERT INTO users(id,name,email,role) VALUES($1,'Matching pro',$2,'pro')",
      [proId, proId + "@example.invalid"],
    );
    await query(
      "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,latitude,longitude,service_radius_miles,address,place_id,service_categories) VALUES($1,'Matching business','Painting','Detailed business','10001',50,true,'approved',$2,$3,25,'Private pro street','private-pro-place',$4)",
      [
        proId,
        i === 6 ? 34.05 : 40.75,
        i === 6 ? -118.24 : -73.99,
        JSON.stringify(["Handyman", "Painting"]),
      ],
    );
    await query(
      "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
      [proId],
    );
  }
  const currentUser = { ...customer, id: customerId };
  const view = await workspace(currentUser);
  const matches = view.profiles.filter((p) =>
    p.matchedProjectIds?.includes(id),
  );
  assert.equal(matches.length, 5);
  assert.equal(
    matches.some((p) => p.id === pros[6]),
    false,
  );
  assert.ok(matches.every((p) => !p.address && !p.placeId));
  const proView = await workspace({ ...professional, id: pros[0] });
  assert.ok(proView.leads.some((p) => p.id === id));
  assert.equal(proView.leads.find((p) => p.id === id)?.address, undefined);
  const distant = await workspace({ ...professional, id: pros[6] });
  assert.equal(
    distant.leads.some((p) => p.id === id),
    false,
  );

  const { discussions } = await import("../src/server/discussions.js");
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.account = { ...currentUser, id: req.headers["x-user"] || customerId };
    next();
  });
  app.use(discussions);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  try {
    const open = (proId: string, userId = customerId) =>
      fetch(base + "/projects/" + id + "/discussions/" + proId, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user": userId },
        body: "{}",
      });
    assert.equal((await open(pros[0], outsider.id)).status, 404);
    assert.equal((await open(pros[6])).status, 403);
    const first = await open(pros[0]);
    assert.equal(first.status, 200);
    const thread = await first.json();
    assert.equal((await (await open(pros[0])).json()).id, thread.id);
    const notifications = await query(
      "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Customer started a private chat'",
      [pros[0]],
    );
    assert.equal((notifications.rows[0] as any).n, 1);
    await query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
      customerId,
      pros[0],
    ]);
    assert.equal((await open(pros[0])).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});

test("appointment confirmation rejects conflicts and out-of-hours visits", async () => {
  const { assertAppointment } = await import("../src/server/scheduling.js");
  const c = await pool.connect();
  const id = randomUUID(),
    otherId = randomUUID();
  const start = new Date(Date.now() + 7 * 86400000);
  start.setUTCHours(14, 0, 0, 0);
  const value = start.toISOString();
  await query(
    "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,status,scheduled_at) VALUES($1,$2,$3,'Booked visit','Detailed work','Handyman','10001','booked',$4)",
    [otherId, customer.id, professional.id, value],
  );
  await assert.rejects(
    assertAppointment(
      c,
      professional.id,
      new Date(start.getTime() + 30 * 60000).toISOString(),
      id,
    ),
    /overlaps/,
  );
  await assert.doesNotReject(
    assertAppointment(
      c,
      professional.id,
      new Date(start.getTime() + 60 * 60000).toISOString(),
      id,
    ),
  );
  await assert.doesNotReject(
    assertAppointment(c, professional.id, value, otherId),
  );
  start.setUTCHours(16, 30, 0, 0);
  await assert.rejects(
    assertAppointment(c, professional.id, start.toISOString(), id),
    /published hours/,
  );
  start.setUTCHours(16, 0, 1, 0);
  await assert.rejects(
    assertAppointment(c, professional.id, start.toISOString(), id),
    /published hours/,
  );
  await assert.rejects(
    assertAppointment(c, null, value, id),
    /Choose a professional/,
  );
  c.release();
});

test("both participants manage work while pauses and completion require the correct actor", async () => {
  const id = await lifecycleProject();
  await assert.rejects(projectAction(id, outsider, { type: "start" }));
  await projectAction(id, customer, { type: "start" }, 1);
  await projectAction(
    id,
    professional,
    { type: "pause", reason: "Waiting for replacement materials" },
    2,
  );
  assert.equal((await projectRow(id)).paused_from, "in_progress");
  await assert.rejects(projectAction(id, customer, { type: "resume" }));
  await assert.rejects(projectAction(id, professional, { type: "complete" }));
  await assert.rejects(
    projectAction(id, professional, { type: "resume" }, 2),
    /changed/,
  );
  await projectAction(id, professional, { type: "resume" }, 3);
  await projectAction(id, customer, { type: "complete" }, 4);
  await assert.rejects(
    projectAction(id, customer, { type: "confirm_completion" }),
  );
  await projectAction(
    id,
    professional,
    { type: "reject_completion", reason: "A final inspection is still needed" },
    5,
  );
  assert.equal((await projectRow(id)).completion_requested, false);
  await projectAction(id, professional, { type: "complete" }, 6);
  await projectAction(id, customer, { type: "confirm_completion" }, 7);
  const p = await projectRow(id);
  assert.equal(p.status, "completed");
  assert.equal(p.version, 8);
  await assert.rejects(projectAction(id, customer, { type: "start" }));
  await assert.rejects(
    projectAction(id, professional, {
      type: "cancel",
      reason: "Too late to cancel",
    }),
  );
  const events = (
    await query("SELECT * FROM project_activity WHERE project_id=$1", [id])
  ).rows;
  assert.equal(events.length, 7);
  for (const u of [customer, professional]) {
    const notices = (
      await query(
        "SELECT * FROM notifications WHERE target_id=$1::text AND user_id=$2",
        [id, u.id],
      )
    ).rows as any[];
    assert.equal(notices.length, 7);
    assert.equal(
      notices.filter((n) => n.title === "Project completed").length,
      1,
    );
  }
});

test("cancelling work underway requires agreement and rejects stale or self responses", async () => {
  const id = await lifecycleProject("in_progress");
  await projectAction(id, professional, {
    type: "cancel",
    reason: "Unable to continue the agreed work",
  });
  let p = await projectRow(id);
  const first = p.cancellation_request_id;
  assert.equal(p.status, "in_progress");
  await assert.rejects(
    projectAction(id, professional, {
      type: "respond_cancellation",
      requestId: first,
      accept: true,
    }),
  );
  await assert.rejects(projectAction(id, customer, { type: "complete" }));
  await assert.rejects(
    projectAction(id, customer, {
      type: "respond_cancellation",
      requestId: randomUUID(),
      accept: true,
    }),
    /changed/,
  );
  await projectAction(id, customer, {
    type: "respond_cancellation",
    requestId: first,
    accept: false,
  });
  assert.equal((await projectRow(id)).cancellation_requested_by, null);
  await projectAction(id, customer, {
    type: "pause",
    reason: "Waiting to decide on next steps",
  });
  await projectAction(id, customer, {
    type: "cancel",
    reason: "The remaining work is no longer needed",
  });
  await projectAction(id, customer, { type: "withdraw_cancellation" });
  await projectAction(id, customer, {
    type: "cancel",
    reason: "We have agreed to stop remaining work",
  });
  p = await projectRow(id);
  await assert.rejects(
    projectAction(id, professional, {
      type: "respond_cancellation",
      requestId: first,
      accept: true,
    }),
    /changed/,
  );
  await projectAction(id, professional, {
    type: "respond_cancellation",
    requestId: p.cancellation_request_id,
    accept: true,
  });
  p = await projectRow(id);
  assert.equal(p.status, "cancelled");
  assert.equal(p.paused_from, null);
  assert.equal(p.scheduled_at, null);
  await assert.rejects(projectAction(id, customer, { type: "complete" }));
  const prework = await lifecycleProject();
  await projectAction(prework, professional, {
    type: "cancel",
    reason: "Cannot attend this booking",
  });
  assert.equal((await projectRow(prework)).status, "cancelled");
});

test("archive is personal and removal cancels only the customer's unassigned request", async () => {
  const archivingPro = { ...professional, id: "archive-pro-" + randomUUID() };
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Archive pro',$2,'pro')",
    [archivingPro.id, archivingPro.id + "@example.invalid"],
  );
  const id = await lifecycleProject("completed");
  await query("UPDATE projects SET pro_id=$2 WHERE id=$1", [
    id,
    archivingPro.id,
  ]);
  await projectAction(id, archivingPro, { type: "archive" });
  assert.equal(
    (await workspace(archivingPro)).projects.find((p) => p.id === id)?.archived,
    true,
  );
  assert.equal(
    (await workspace(customer)).projects.find((p) => p.id === id)?.archived,
    false,
  );
  assert.equal((await projectRow(id)).status, "completed");
  await projectAction(id, archivingPro, { type: "restore" });
  assert.equal(
    (await workspace(archivingPro)).projects.find((p) => p.id === id)?.archived,
    false,
  );
  await assert.rejects(projectAction(id, outsider, { type: "archive" }));
  const active = await lifecycleProject();
  await assert.rejects(projectAction(active, customer, { type: "archive" }));
  await assert.rejects(
    projectAction(active, archivingPro, {
      type: "delete",
      reason: "Cannot remove another person's project",
    }),
  );
  const open = await lifecycleProject("requested", false);
  await projectAction(open, customer, {
    type: "pause",
    reason: "Need to reconsider the project",
  });
  await projectAction(open, customer, {
    type: "delete",
    reason: "This request is no longer needed",
  });
  assert.equal((await projectRow(open)).status, "cancelled");
  assert.equal(
    (await workspace(customer)).projects.find((p) => p.id === open)?.archived,
    true,
  );
  await projectAction(open, customer, { type: "restore" });
  assert.equal((await projectRow(open)).status, "cancelled");
});

test("publication alerts every matching pro and pause/resume refreshes the opportunity audience", async () => {
  const { notifyMatchingProfessionals } =
    await import("../src/server/project-events.js");
  const { transaction } = await import("../src/server/db/index.js");
  const id = await lifecycleProject("requested", false);
  await query("UPDATE projects SET zip='60601' WHERE id=$1", [id]);
  const proIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const uid = "notify-pro-" + randomUUID();
    proIds.push(uid);
    await query(
      "INSERT INTO users(id,name,email,role) VALUES($1,'Notification pro',$2,'pro')",
      [uid, uid + "@example.invalid"],
    );
    await query(
      "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,service_categories) VALUES($1,'Business','Handyman','Detailed business','60601',50,true,'approved',jsonb_build_array('Handyman'))",
      [uid],
    );
    await query(
      "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
      [uid],
    );
  }
  await query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
    customer.id,
    proIds[6],
  ]);
  await query("UPDATE profiles SET suspended=true WHERE id=$1", [proIds[7]]);
  await query(
    "UPDATE profiles SET service_categories=jsonb_build_array('Painting') WHERE id=$1",
    [proIds[8]],
  );
  await query(
    "UPDATE professional_subscriptions SET status='past_due' WHERE user_id=$1",
    [proIds[9]],
  );
  const events: string[] = [];
  const stop = await db.listen("aplime_notifications", (value) =>
    events.push(value),
  );
  try {
    await assert.rejects(
      transaction(async (c) => {
        await notifyMatchingProfessionals(c, id);
        throw new Error("rollback fanout");
      }),
    );
    assert.equal(events.length, 0);
    await transaction((c) => notifyMatchingProfessionals(c, id));
    assert.deepEqual(new Set(events), new Set(proIds.slice(0, 6)));
    assert.equal(
      (await workspace(customer)).profiles.filter((p) =>
        p.matchedProjectIds?.includes(id),
      ).length,
      5,
    );
    await projectAction(id, customer, {
      type: "pause",
      reason: "Private reason must not be sent to unassigned professionals",
    });
    for (const uid of proIds.slice(0, 6)) {
      assert.equal(
        (await workspace({ ...professional, id: uid })).leads.some(
          (p) => p.id === id,
        ),
        false,
      );
      const alerts = (
        await query(
          "SELECT body FROM notifications WHERE user_id=$1 AND title='Project paused'",
          [uid],
        )
      ).rows as any[];
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].body.includes("Private reason"), false);
    }
    await projectAction(id, customer, { type: "resume" });
    const alerts = (
      await query(
        "SELECT user_id FROM notifications WHERE target_id=$1::text AND title='Project available again'",
        [id],
      )
    ).rows as any[];
    assert.deepEqual(
      new Set(alerts.map((a) => a.user_id)),
      new Set(proIds.slice(0, 6)),
    );
    assert.equal(
      (await workspace({ ...professional, id: proIds[0] })).leads.some(
        (p) => p.id === id,
      ),
      true,
    );
  } finally {
    await stop();
  }
});

test("professionals can withdraw only their own pending estimate and resubmit a new revision", async () => {
  const quotingPro = { ...professional, id: "withdraw-pro-" + randomUUID() };
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Quoting pro',$2,'pro')",
    [quotingPro.id, quotingPro.id + "@example.invalid"],
  );
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status) VALUES($1,'Business','Handyman','Detailed business','10001',50,true,'approved')",
    [quotingPro.id],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [quotingPro.id],
  );
  const id = await lifecycleProject("requested", false);
  const offer = {
    type: "quote" as const,
    laborAmount: 10000,
    materialsAmount: 0,
    description: "A detailed scope of work",
    exclusions: "",
    timeline: "One workday",
    expiresAt: null,
  };
  await projectAction(id, quotingPro, offer);
  await query("UPDATE profiles SET available=false WHERE id=$1", [
    quotingPro.id,
  ]);
  assert.equal(
    (await workspace(quotingPro)).leads.some((p) => p.id === id),
    true,
  );
  const q = (await query("SELECT * FROM quotes WHERE project_id=$1", [id]))
    .rows[0] as any;
  await assert.rejects(
    projectAction(id, customer, {
      type: "withdraw_quote",
      reason: "Only the professional owns this estimate",
    }),
  );
  await projectAction(id, quotingPro, {
    type: "withdraw_quote",
    reason: "Need to revise material costs",
  });
  assert.equal((await projectRow(id)).status, "requested");
  await assert.rejects(
    projectAction(id, customer, { type: "accept", quoteId: q.id, revision: 1 }),
    /no longer available/,
  );
  await assert.rejects(
    projectAction(id, quotingPro, {
      type: "withdraw_quote",
      reason: "Duplicate should have no effect",
    }),
  );
  await query("UPDATE profiles SET available=true WHERE id=$1", [
    quotingPro.id,
  ]);
  await projectAction(id, quotingPro, offer);
  const revised = (
    await query("SELECT * FROM quotes WHERE project_id=$1", [id])
  ).rows[0] as any;
  assert.equal(revised.status, "pending");
  assert.equal(revised.revision, 3);
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: 3,
  });
  await assert.rejects(
    projectAction(id, quotingPro, {
      type: "withdraw_quote",
      reason: "Cannot withdraw an accepted estimate",
    }),
  );
});

test("project activity excludes outsiders and competing professional details", async () => {
  const { readProjectActivity, recordProjectActivity } =
    await import("../src/server/project-events.js");
  const { transaction } = await import("../src/server/db/index.js");
  const id = await lifecycleProject();
  await transaction(async (c) => {
    await recordProjectActivity(
      c,
      id,
      customer.id,
      "publish",
      "Project published",
    );
    await recordProjectActivity(
      c,
      id,
      professional.id,
      "quote",
      "Selected estimate",
    );
    await recordProjectActivity(
      c,
      id,
      outsider.id,
      "withdraw_quote",
      "Competing estimate",
      "Competitor private scope",
    );
  });
  assert.equal((await readProjectActivity(id, customer.id)).length, 3);
  const proEvents = await readProjectActivity(id, professional.id);
  assert.equal(proEvents.length, 2);
  assert.equal(
    proEvents.some((e) => e.reason === "Competitor private scope"),
    false,
  );
  await assert.rejects(readProjectActivity(id, outsider.id), /private/);
});

async function approvedPro(label: string) {
  const pro = { ...professional, id: label + "-" + randomUUID() };
  await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,'pro')", [
    pro.id,
    label,
    pro.id + "@example.invalid",
  ]);
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,review_note) VALUES($1,$2,'Handyman','Detailed business','10001',50,true,'approved','Internal reviewer note')",
    [pro.id, label + " business"],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [pro.id],
  );
  return pro;
}
const estimate = {
  type: "quote" as const,
  laborAmount: 20000,
  materialsAmount: 0,
  description: "A detailed scope of work",
  exclusions: "",
  timeline: "One workday",
  expiresAt: null,
};

test("customers can decline an expired estimate but cannot accept it", async () => {
  const pro = await approvedPro("expiring");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, pro, estimate);
  await query(
    "UPDATE quotes SET expires_at=now()-interval '1 day' WHERE project_id=$1",
    [id],
  );
  const q = (await query("SELECT * FROM quotes WHERE project_id=$1", [id]))
    .rows[0] as any;
  await assert.rejects(
    projectAction(id, customer, {
      type: "accept",
      quoteId: q.id,
      revision: q.revision,
    }),
    /no longer available/,
  );
  await projectAction(id, customer, { type: "decline", quoteId: q.id });
  assert.equal((await projectRow(id)).status, "requested");
});

test("accepting an estimate re-checks subscription and blocking, and keeps withdrawn history", async () => {
  const lapsed = await approvedPro("lapsed");
  const withdrawn = await approvedPro("withdrawn");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, lapsed, estimate);
  await projectAction(id, withdrawn, estimate);
  await projectAction(id, withdrawn, {
    type: "withdraw_quote",
    reason: "Cannot take this job",
  });
  await query(
    "UPDATE professional_subscriptions SET status='canceled' WHERE user_id=$1",
    [lapsed.id],
  );
  const q = (await query("SELECT * FROM quotes WHERE pro_id=$1", [lapsed.id]))
    .rows[0] as any;
  await assert.rejects(
    projectAction(id, customer, {
      type: "accept",
      quoteId: q.id,
      revision: q.revision,
    }),
    /can no longer be booked/,
  );
  await query(
    "UPDATE professional_subscriptions SET status='active' WHERE user_id=$1",
    [lapsed.id],
  );
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  const statuses = Object.fromEntries(
    (
      await query("SELECT pro_id,status FROM quotes WHERE project_id=$1", [id])
    ).rows.map((r: any) => [r.pro_id, r.status]),
  );
  assert.equal(statuses[lapsed.id], "accepted");
  assert.equal(statuses[withdrawn.id], "withdrawn");
});

test("a directly requested professional cannot hold the request hostage and the customer can open it up", async () => {
  const direct = await approvedPro("direct");
  const other = await approvedPro("other-open");
  const id = await lifecycleProject("requested", false);
  await query("UPDATE projects SET pro_id=$2 WHERE id=$1", [id, direct.id]);
  await assert.rejects(
    projectAction(id, direct, {
      type: "pause",
      reason: "Not interested right now",
    }),
    /not available/,
  );
  await assert.rejects(
    projectAction(id, direct, {
      type: "cancel",
      reason: "Not interested right now",
    }),
    /not available/,
  );
  await assert.rejects(projectAction(id, other, estimate), /not available/);
  await assert.rejects(
    projectAction(id, direct, { type: "open_request" }),
    /not available/,
  );
  await projectAction(id, customer, { type: "open_request" });
  assert.equal((await projectRow(id)).pro_id, null);
  await projectAction(id, other, estimate);
  assert.equal((await projectRow(id)).status, "quoted");
  const alerts = (
    await query(
      "SELECT user_id FROM notifications WHERE target_id=$1 AND title='Project open for estimates'",
      [id],
    )
  ).rows as any[];
  assert.equal(
    alerts.filter((row) => row.user_id === other.id).length,
    1,
    "matching professionals hear about the reopened request once",
  );
});

test("matching professionals can see project photos before quoting, and outsiders cannot", async () => {
  const pro = await approvedPro("photo-viewer");
  const id = await lifecycleProject("requested", false);
  const upload = randomUUID();
  await query(
    "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size,status) VALUES($1,$2,$3,'k','leak.jpg','image/jpeg',100,'ready')",
    [upload, id, customer.id],
  );
  await query(
    "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size,status) VALUES($1,$2,$3,'k2','plan.pdf','application/pdf',100,'ready')",
    [randomUUID(), id, customer.id],
  );
  const { isOpenLead } = await import("../src/server/matching.js");
  const files = (await workspace(pro)).uploads.filter(
    (f) => f.projectId === id,
  );
  assert.deepEqual(
    files.map((f) => f.name),
    ["leak.jpg"],
  );
  assert.equal(await isOpenLead(pro.id, id), true);
  await query("UPDATE profiles SET available=false WHERE id=$1", [pro.id]);
  assert.equal(await isOpenLead(pro.id, id), false);
  assert.equal(
    (await workspace(pro)).uploads.some((f) => f.projectId === id),
    false,
  );
});

test("internal review fields never reach other users' workspaces or public listings", async () => {
  const pro = await approvedPro("private-note");
  await query("UPDATE profiles SET business='!First listed' WHERE id=$1", [
    pro.id,
  ]);
  const { publicProfiles } = await import("../src/server/repository.js");
  const listed = (await publicProfiles(pro.id))[0] as any;
  assert.ok(listed);
  assert.equal(listed.reviewNote, undefined);
  assert.equal(listed.submittedAt, undefined);
  const id = await lifecycleProject("booked", false);
  await query("UPDATE projects SET pro_id=$2 WHERE id=$1", [id, pro.id]);
  const seen = (await workspace(customer)).profiles.find(
    (p) => p.id === pro.id,
  ) as any;
  assert.ok(seen);
  assert.equal(seen.reviewNote, undefined);
  const own = (await workspace(pro)).profiles.find(
    (p) => p.id === pro.id,
  ) as any;
  assert.equal(own.reviewNote, "Internal reviewer note");
  const admin = {
    id: "admin-" + randomUUID(),
    name: "Admin",
    email: "admin@example.invalid",
    role: "admin" as const,
    settings: {},
  };
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Admin',$2,'admin')",
    [admin.id, admin.email],
  );
  const reviewed = (await workspace(admin)).profiles.find(
    (p) => p.id === pro.id,
  ) as any;
  assert.equal(reviewed.reviewNote, "Internal reviewer note");
});

test("losing professionals keep their estimate history and are told it was not selected", async () => {
  const winner = await approvedPro("winner");
  const loser = await approvedPro("loser");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, winner, estimate);
  await projectAction(id, loser, estimate);
  const q = (await query("SELECT * FROM quotes WHERE pro_id=$1", [winner.id]))
    .rows[0] as any;
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  let history = (await workspace(loser)).quotes.filter(
    (row) => row.projectId === id,
  );
  assert.equal(history[0].status, "pending");
  assert.equal(
    (
      await query(
        "SELECT 1 FROM notifications WHERE user_id=$1 AND title='Project awarded'",
        [loser.id],
      )
    ).rows.length,
    0,
  );
  await projectAction(id, winner, { type: "accept_award" });
  history = (await workspace(loser)).quotes.filter(
    (row) => row.projectId === id,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].status, "declined");
  assert.equal(history[0].projectTitle, "Lifecycle project");
  const notice = (
    await query(
      "SELECT body FROM notifications WHERE user_id=$1 AND title='Project awarded'",
      [loser.id],
    )
  ).rows[0] as any;
  assert.match(notice.body, /not selected/);
});

test("a declined award restores the open request and a withdrawn award reopens the estimate", async () => {
  const first = await approvedPro("first");
  const second = await approvedPro("second");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, first, estimate);
  await projectAction(id, second, estimate);
  const quoteOf = async (pro: { id: string }) =>
    (
      await query("SELECT * FROM quotes WHERE pro_id=$1 AND project_id=$2", [
        pro.id,
        id,
      ])
    ).rows[0] as any;
  let q = await quoteOf(first);
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  let row = await projectRow(id);
  assert.equal(row.status, "booked");
  assert.equal(row.award_accepted, false);
  await assert.rejects(projectAction(id, first, { type: "start" }));
  await assert.rejects(projectAction(id, second, { type: "accept_award" }));
  await projectAction(id, first, {
    type: "decline_award",
    reason: "Schedule conflict",
  });
  row = await projectRow(id);
  assert.equal(row.status, "quoted");
  assert.equal(row.pro_id, null);
  assert.equal(row.award_accepted, true);
  assert.equal((await quoteOf(first)).status, "declined");
  assert.equal((await quoteOf(second)).status, "pending");
  q = await quoteOf(second);
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  await projectAction(id, customer, { type: "withdraw_award" });
  row = await projectRow(id);
  assert.equal(row.pro_id, null);
  q = await quoteOf(second);
  assert.equal(q.status, "pending");
  assert.equal(row.status, "quoted");
  await assert.rejects(
    projectAction(id, customer, { type: "accept", quoteId: q.id, revision: 1 }),
    /changed/,
  );
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  await projectAction(id, second, { type: "accept_award" });
  await projectAction(id, customer, { type: "start" });
  assert.equal((await projectRow(id)).status, "in_progress");
});

test("lapsed estimates expire, reopen the project and can be re-sent", async () => {
  const { expireEstimates } = await import("../src/server/estimates.js");
  const pro = await approvedPro("lapse");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, pro, estimate);
  await query(
    "UPDATE quotes SET expires_at=now()-interval '1 hour' WHERE project_id=$1",
    [id],
  );
  const before = (await projectRow(id)).version;
  assert.ok((await expireEstimates()) >= 1);
  const row = await projectRow(id);
  assert.equal(row.status, "requested");
  assert.ok(row.version > before);
  const q = (await query("SELECT * FROM quotes WHERE project_id=$1", [id]))
    .rows[0] as any;
  assert.equal(q.status, "expired");
  for (const user of [pro.id, customer.id])
    assert.ok(
      (
        await query(
          "SELECT 1 FROM notifications WHERE user_id=$1 AND target_id=$2 AND title LIKE '%expired'",
          [user, id],
        )
      ).rows.length,
    );
  assert.equal(await expireEstimates(), 0);
  await projectAction(id, pro, estimate);
  assert.equal((await projectRow(id)).status, "quoted");
});

test("email outbox claims batches, marks sent, and backs off failures", async () => {
  const { deliverOutbox } = await import("../src/server/outbox.js");
  await query("DELETE FROM email_outbox");
  const mail = await approvedPro("mail");
  for (const subject of ["a", "b", "c"])
    await query(
      "INSERT INTO email_outbox(id,user_id,subject,body) VALUES($1,$2,$3,'body')",
      [randomUUID(), mail.id, subject],
    );
  const sent: string[] = [];
  assert.equal(
    await deliverOutbox(async (_to, subject) => {
      if (subject === "b") throw new Error("provider down");
      sent.push(subject);
    }, 10),
    3,
  );
  assert.deepEqual(sent.sort(), ["a", "c"]);
  assert.equal(await deliverOutbox(async () => {}, 10), 0);
  const rows = (
    await query(
      "SELECT subject,sent_at,attempts,next_attempt_at>now() AS later FROM email_outbox ORDER BY subject",
    )
  ).rows as any[];
  assert.ok(rows[0].sent_at && !rows[1].sent_at && rows[2].sent_at);
  assert.equal(rows[1].attempts, 1);
  assert.ok(rows[1].later);
});

test("new project alerts are capped and ranked by review volume", async () => {
  const { notifyMatchingProfessionals, ALERT_LIMIT } =
    await import("../src/server/project-events.js");
  const crowd = [];
  for (let i = 0; i < ALERT_LIMIT + 3; i++)
    crowd.push(await approvedPro("crowd" + i));
  const id = await lifecycleProject("requested", false);
  const alerted = await pool
    .connect()
    .then(async (c) =>
      notifyMatchingProfessionals(c as any, id, "Capped alert"),
    );
  assert.equal(alerted.length, ALERT_LIMIT);
  const ids = new Set(alerted);
  assert.equal(
    (
      (
        await query(
          "SELECT count(*)::int AS n FROM notifications WHERE target_id=$1 AND title='Capped alert'",
          [id],
        )
      ).rows[0] as any
    ).n,
    ALERT_LIMIT,
  );
  assert.equal(ids.size, ALERT_LIMIT);
});

test("customers cannot hire or review an account sharing their normalized email", async () => {
  const self = await approvedPro("self");
  await query("UPDATE users SET email='jane.doe+biz@gmail.com' WHERE id=$1", [
    self.id,
  ]);
  const id = await lifecycleProject("requested", false);
  await query("UPDATE users SET email='janedoe@gmail.com' WHERE id=$1", [
    customer.id,
  ]);
  await assert.rejects(projectAction(id, self, estimate), /same person/);
  await query("UPDATE users SET email='customer@example.invalid' WHERE id=$1", [
    customer.id,
  ]);
  await projectAction(id, self, estimate);
  await query("UPDATE users SET email='janedoe@gmail.com' WHERE id=$1", [
    customer.id,
  ]);
  const q = (await query("SELECT * FROM quotes WHERE pro_id=$1", [self.id]))
    .rows[0] as any;
  await assert.rejects(
    projectAction(id, customer, {
      type: "accept",
      quoteId: q.id,
      revision: q.revision,
    }),
    /same person/,
  );
  await query("UPDATE users SET email='customer@example.invalid' WHERE id=$1", [
    customer.id,
  ]);
});

test("ranking prefers proven review volume over a single perfect review", async () => {
  const { rankSql } = await import("../src/server/matching.js");
  const thin = await approvedPro("thin");
  const proven = await approvedPro("proven");
  const addReview = async (pro: { id: string }, rating: number) =>
    query(
      "INSERT INTO reviews(id,project_id,pro_id,rating,body) VALUES($1,$2,$3,$4,'Solid work done')",
      [randomUUID(), await lifecycleProject("completed"), pro.id, rating],
    );
  await addReview(thin, 5);
  for (let i = 0; i < 10; i++) await addReview(proven, 5);
  const id = await lifecycleProject("requested", false);
  const order = (
    await query(
      `SELECT f.id FROM profiles f JOIN projects p ON p.id=$1 WHERE f.id=ANY($2::text[]) ORDER BY ${rankSql()}`,
      [id, [thin.id, proven.id]],
    )
  ).rows.map((row: any) => row.id);
  assert.deepEqual(order, [proven.id, thin.id]);
});

test("customers edit an open request, interested pros are told, and locked states reject edits", async () => {
  const pro = await approvedPro("edit-watcher");
  const id = await lifecycleProject("requested", false);
  await projectAction(id, pro, estimate);
  const edit = {
    type: "update_details" as const,
    title: "Updated lifecycle project",
    description: "A clearer description of the updated project scope.",
    urgency: "this_week" as const,
    budgetMin: 10000,
    budgetMax: 50000,
  };
  await assert.rejects(projectAction(id, pro, edit), /not available/);
  const before = (await projectRow(id)).version;
  await projectAction(id, customer, edit);
  const row = await projectRow(id);
  assert.equal(row.title, "Updated lifecycle project");
  assert.equal(row.urgency, "this_week");
  assert.ok(row.version > before);
  assert.equal(
    (
      await query(
        "SELECT 1 FROM notifications WHERE user_id=$1 AND title='Project details updated'",
        [pro.id],
      )
    ).rows.length,
    1,
  );
  const q = (await query("SELECT * FROM quotes WHERE pro_id=$1", [pro.id]))
    .rows[0] as any;
  await projectAction(id, customer, {
    type: "accept",
    quoteId: q.id,
    revision: q.revision,
  });
  await assert.rejects(projectAction(id, customer, edit), /not available/);
});

test("saved, estimating and blocked professionals resolve correctly in the customer workspace", async () => {
  const prefix = "saved-" + randomUUID();
  const shopper = {
    id: prefix + "-shopper",
    name: "Saving customer",
    email: prefix + "-shopper@example.invalid",
    role: "customer" as const,
    settings: {},
  };
  const pros = {
    heart: prefix + "-heart",
    quote: prefix + "-quote",
    blocked: prefix + "-blocked",
  };
  await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
    shopper.id,
    shopper.name,
    shopper.email,
    "customer",
  ]);
  for (const id of Object.values(pros)) {
    await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
      id,
      "Fixture pro",
      id + "@example.invalid",
      "pro",
    ]);
    // Draft, unverified profiles: saving must not depend on review state.
    await query(
      "INSERT INTO profiles(id,business,category,bio,zip,rate) VALUES($1,'Business ' || $1,'Painting','A plain unreviewed business profile','10001',40)",
      [id],
    );
  }
  await query("INSERT INTO saved(user_id,pro_id) VALUES($1,$2),($1,$3)", [
    shopper.id,
    pros.heart,
    pros.blocked,
  ]);
  await query("INSERT INTO blocked(user_id,other_id) VALUES($1,$2)", [
    shopper.id,
    pros.blocked,
  ]);
  const projectId = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,'Fence painting','Repaint the back fence completely','Painting','10001')",
    [projectId, shopper.id],
  );
  await query(
    "INSERT INTO quotes(id,project_id,pro_id,amount,description) VALUES($1,$2,$3,20000,'Fence repaint estimate')",
    [randomUUID(), projectId, pros.quote],
  );
  const view = await workspace(shopper);
  assert.ok(view.saved.includes(pros.heart));
  const shown = view.profiles.map((p) => p.id);
  assert.ok(
    shown.includes(pros.heart),
    "a saved draft profile stays visible so it can be unsaved",
  );
  assert.ok(
    shown.includes(pros.quote),
    "a professional who sent an estimate is available to the customer",
  );
  assert.ok(
    !shown.includes(pros.blocked),
    "a blocked professional is hidden even when saved",
  );
  // The save endpoint's insert predicate refuses suspended profiles.
  await query("UPDATE profiles SET suspended=true WHERE id=$1", [pros.quote]);
  const refused = await query(
    "INSERT INTO saved(user_id,pro_id) SELECT $1,id FROM profiles WHERE id=$2 AND NOT suspended ON CONFLICT DO NOTHING",
    [shopper.id, pros.quote],
  );
  assert.equal(refused.rowCount, 0);
  const allowed = await query(
    "INSERT INTO saved(user_id,pro_id) SELECT $1,id FROM profiles WHERE id=$2 AND NOT suspended ON CONFLICT DO NOTHING",
    [shopper.id, pros.heart],
  );
  assert.equal(allowed.rowCount, 0); // already saved: conflict, not an error
});

test("a listed business stays publicly visible while edits await re-review", async () => {
  const prefix = "listed-" + randomUUID();
  const id = prefix + "-pro";
  await query(
    "INSERT INTO users(id,name,email,role) VALUES($1,'Listed pro',$2,'pro')",
    [id, prefix + "@example.invalid"],
  );
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,listed) VALUES($1,'Listed business','Painting','A reviewed business profile','10001',60,true,'approved',true)",
    [id],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [id],
  );
  const { publicProfiles } = await import("../src/server/repository.js");
  assert.equal((await publicProfiles(id)).length, 1);
  // A material edit auto-resubmits for review but keeps the listing live.
  await query(
    "UPDATE profiles SET review_status='pending',submitted_at=now() WHERE id=$1",
    [id],
  );
  assert.equal((await publicProfiles(id)).length, 1);
  // Rejecting or requesting changes clears the flag and takes the page down.
  await query(
    "UPDATE profiles SET review_status='changes_requested',listed=false WHERE id=$1",
    [id],
  );
  assert.equal((await publicProfiles(id)).length, 0);
  // A never-approved pending submission is not public.
  await query(
    "UPDATE profiles SET review_status='pending',listed=false WHERE id=$1",
    [id],
  );
  assert.equal((await publicProfiles(id)).length, 0);
});

test("identity workflow resumes the owner's session and trusts only confirmed signed results", async () => {
  const { default: express } = await import("express");
  const { identityVerification } =
    await import("../src/server/identity-verification.js");
  const { errorResponse } = await import("../src/server/error-response.js");
  const owner = {
    ...professional,
    id: "identity-owner-" + randomUUID(),
    email: "identity-" + randomUUID() + "@example.invalid",
  };
  await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,'pro')", [
    owner.id,
    owner.name,
    owner.email,
  ]);
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate) VALUES($1,'Identity test business','Handyman','Verification fixture','10001',50)",
    [owner.id],
  );
  const sessions = stripe().identity.verificationSessions;
  const originalRetrieve = sessions.retrieve,
    originalCreate = sessions.create;
  let status = "requires_input",
    sessionId = "vs_fixture_" + randomUUID(),
    creates = 0;
  let failure: any = null;
  const fakeSession = () => ({
    id: sessionId,
    status,
    url: "https://verify.stripe.com/fixture",
    client_secret: "owner-only-secret",
    last_error: failure,
    verified_outputs: { id_number: "PRIVATE_DOCUMENT" },
  });
  sessions.retrieve = (async (id: string) => {
    assert.equal(id, sessionId);
    return fakeSession();
  }) as any;
  sessions.create = (async (body: any, options: any) => {
    creates++;
    assert.equal(body.return_url.endsWith("/app/verification/return"), true);
    assert.deepEqual(body.options, {
      document: { require_matching_selfie: true },
    });
    assert.equal(body.metadata.userId, owner.id);
    assert.ok(options.idempotencyKey.startsWith("identity:" + owner.id + ":"));
    status = "requires_input";
    failure = null;
    return fakeSession();
  }) as any;
  const app = express();
  app.use("/webhooks", webhooks);
  app.use(express.json());
  app.use((req, _r, next) => {
    req.account = req.headers["x-test-user"] === owner.id ? owner : outsider;
    next();
  });
  app.use("/identity", identityVerification);
  app.use((e: any, _q: any, r: any, _n: any) => {
    const result = errorResponse(e);
    r.status(result.status).json(result.body);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const call = (method = "GET", user = owner.id) =>
    fetch(base + "/identity", {
      method,
      headers: { "x-test-user": user, "Content-Type": "application/json" },
      ...(method === "POST"
        ? {
            body: JSON.stringify({
              userId: professional.id,
              verified: true,
              return_url: "https://evil.example",
            }),
          }
        : {}),
    });
  const sendEvent = async (type: string, id = sessionId) => {
    const payload = JSON.stringify({
      id: "evt_identity_flow_" + randomUUID(),
      type,
      data: { object: { id, metadata: { userId: professional.id } } },
    });
    const signature = stripe().webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_identity_fixture",
    });
    const response = await fetch(base + "/webhooks/stripe-identity", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });
    assert.equal(response.status, 200);
  };
  try {
    assert.equal((await call("GET", outsider.id)).status, 403);
    assert.equal((await call("POST", outsider.id)).status, 403);
    assert.equal((await (await call()).json()).status, "not_started");
    const start = await call("POST");
    assert.equal(start.headers.get("cache-control"), "no-store");
    const initial = await start.json();
    assert.equal(initial.clientSecret, "owner-only-secret");
    assert.equal(initial.publishableKey, "pk_test_fixture");
    assert.equal(initial.verified_outputs, undefined);
    assert.equal(creates, 1);
    await call("POST");
    assert.equal(creates, 1, "resume must reuse the stored session");
    const safe = await (await call()).json();
    assert.equal(safe.status, "requires_input");
    assert.equal(safe.clientSecret, undefined);
    assert.equal(safe.url, undefined);
    assert.equal(JSON.stringify(safe).includes("PRIVATE_DOCUMENT"), false);
    failure = { code: "document_expired", reason: "PRIVATE_PROVIDER_TEXT" };
    const attention = await (await call()).json();
    assert.equal(attention.needsAttention, true);
    assert.match(attention.message, /unexpired/);
    assert.equal(
      JSON.stringify(attention).includes("PRIVATE_PROVIDER_TEXT"),
      false,
    );
    status = "processing";
    assert.equal((await (await call("POST")).json()).status, "processing");
    assert.equal(creates, 1);
    status = "verified";
    const waiting = await (await call()).json();
    assert.equal(waiting.status, "processing");
    assert.equal(waiting.awaitingConfirmation, true);
    assert.equal((await (await call("POST")).json()).status, "processing");
    assert.equal(creates, 1);
    assert.equal(
      (
        (await query("SELECT verified FROM profiles WHERE id=$1", [owner.id]))
          .rows[0] as { verified: boolean }
      ).verified,
      false,
    );
    await sendEvent("identity.verification_session.verified");
    assert.equal((await (await call()).json()).status, "verified");
    // A delayed requires_input event reads the current verified Stripe state.
    await sendEvent("identity.verification_session.requires_input");
    assert.equal(
      (
        (await query("SELECT verified FROM profiles WHERE id=$1", [owner.id]))
          .rows[0] as { verified: boolean }
      ).verified,
      true,
    );
    assert.equal((await (await call("POST")).json()).status, "verified");
    assert.equal(creates, 1);
    await query("UPDATE profiles SET verified=false WHERE id=$1", [owner.id]);
    status = "canceled";
    await sendEvent("identity.verification_session.canceled");
    assert.equal((await (await call()).json()).status, "canceled");
    const previousId = sessionId;
    sessionId = "vs_restarted_" + randomUUID();
    // Retrieve the canceled session, create a fresh one, then ignore the old session's late webhook.
    sessions.retrieve = (async (id: string) =>
      id === previousId
        ? { ...fakeSession(), id, status: "canceled" }
        : fakeSession()) as any;
    await call("POST");
    assert.equal(creates, 2);
    await sendEvent("identity.verification_session.verified", previousId);
    assert.equal(
      (
        (await query("SELECT verified FROM profiles WHERE id=$1", [owner.id]))
          .rows[0] as { verified: boolean }
      ).verified,
      false,
    );
    assert.equal(
      (
        (
          await query("SELECT identity_session_id FROM profiles WHERE id=$1", [
            owner.id,
          ])
        ).rows[0] as any
      ).identity_session_id,
      sessionId,
    );
  } finally {
    sessions.retrieve = originalRetrieve;
    sessions.create = originalCreate;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("identity provider failures preserve the profile and version retry keys with return parameters", async () => {
  const { default: express } = await import("express");
  const { identityVerification } =
    await import("../src/server/identity-verification.js");
  const { errorResponse } = await import("../src/server/error-response.js");
  const { env } = await import("../src/server/config.js");
  const owner = {
    ...professional,
    id: "identity-error-" + randomUUID(),
    email: "identity-error-" + randomUUID() + "@example.invalid",
  };
  await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,'pro')", [
    owner.id,
    owner.name,
    owner.email,
  ]);
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate) VALUES($1,'Identity error fixture','Handyman','Provider error test','10001',50)",
    [owner.id],
  );
  const sessions = stripe().identity.verificationSessions;
  const oldCreate = sessions.create,
    oldRetrieve = sessions.retrieve,
    oldSite = env.SITE_URL;
  const keys: string[] = [];
  sessions.create = (async (_parameters: any, options: any) => {
    keys.push(options.idempotencyKey);
    throw Object.assign(new Error("SECRET_STRIPE_RESPONSE"), {
      type: "StripePermissionError",
      statusCode: 403,
      requestId: "req_IdentitySetup123",
    });
  }) as any;
  sessions.retrieve = (async () => {
    throw Object.assign(new Error("SECRET_SAVED_SESSION"), {
      type: "StripeInvalidRequestError",
      code: "resource_missing",
      statusCode: 404,
    });
  }) as any;
  const app = express();
  app.use(express.json());
  app.use((req, _r, next) => {
    req.account = owner;
    next();
  });
  app.use("/identity", identityVerification);
  app.use((e: any, _q: any, r: any, _n: any) => {
    const result = errorResponse(e);
    r.status(result.status).json(result.body);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" + (server.address() as any).port + "/identity";
  try {
    for (let i = 0; i < 3; i++) {
      if (i === 2) env.SITE_URL = "https://changed-development.example.invalid";
      const response = await fetch(url, { method: "POST" });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.code, "IDENTITY_CONFIGURATION_ERROR");
      assert.equal(body.requestId, "req_IdentitySetup123");
      assert.equal(JSON.stringify(body).includes("SECRET"), false);
    }
    assert.equal(
      keys[0],
      keys[1],
      "unchanged retries use identical idempotency keys",
    );
    assert.notEqual(
      keys[1],
      keys[2],
      "changed return URL cannot collide with an earlier request",
    );
    assert.notEqual(
      keys[0],
      "identity:" + owner.id + ":initial",
      "new parameters cannot collide with the old deployment's key",
    );
    const profile = (
      await query(
        "SELECT verified,identity_session_id FROM profiles WHERE id=$1",
        [owner.id],
      )
    ).rows[0] as any;
    assert.equal(profile.verified, false);
    assert.equal(profile.identity_session_id, null);
    await query(
      "UPDATE profiles SET identity_session_id='vs_unavailable_fixture' WHERE id=$1",
      [owner.id],
    );
    for (const method of ["GET", "POST"]) {
      const response = await fetch(url, { method });
      assert.equal(response.status, 503);
      assert.equal(
        (await response.json()).code,
        "IDENTITY_SESSION_UNAVAILABLE",
      );
    }
    assert.equal(
      keys.length,
      3,
      "an unavailable saved session never silently creates another",
    );
    assert.equal(
      (
        (
          await query("SELECT identity_session_id FROM profiles WHERE id=$1", [
            owner.id,
          ])
        ).rows[0] as any
      ).identity_session_id,
      "vs_unavailable_fixture",
    );
  } finally {
    sessions.create = oldCreate;
    sessions.retrieve = oldRetrieve;
    env.SITE_URL = oldSite;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("three-plan checkout selects server prices, safely switches sessions, and activates only through signed webhooks", async () => {
  const { env } = await import("../src/server/config.js");
  const { subscriptions } = await import("../src/server/subscriptions.js");
  const { default: express } = await import("express");
  const owner = await approvedPro("membership-plans");
  const oldEnv = { ...env };
  const stripeClient = stripe();
  const oldPrices = stripeClient.prices.retrieve;
  const oldRetrieve = stripeClient.checkout.sessions.retrieve;
  const oldCreate = stripeClient.checkout.sessions.create;
  const oldExpire = stripeClient.checkout.sessions.expire;
  const oldSubscription = stripeClient.subscriptions.retrieve;
  const suffix = randomUUID();
  const customerId = "cus_plans_" + suffix;
  const prices: Record<string, any> = {};
  const planIds = {
    monthly: "price_monthly_" + suffix,
    six_month: "price_six_" + suffix,
    yearly: "price_yearly_" + suffix,
  };
  for (const [id, amount, months] of [
    [planIds.monthly, 4000, 1],
    [planIds.six_month, 21000, 6],
    [planIds.yearly, 36000, 12],
  ] as const)
    prices[id] = {
      id,
      active: true,
      type: "recurring",
      currency: "usd",
      livemode: false,
      unit_amount: amount,
      recurring: {
        interval: "month",
        interval_count: months,
        usage_type: "licensed",
      },
    };
  Object.assign(env, {
    APP_ENV: "development",
    STRIPE_PRO_MONTHLY_PRICE_ID: planIds.monthly,
    STRIPE_PRO_SIX_MONTH_PRICE_ID: planIds.six_month,
    STRIPE_PRO_YEARLY_PRICE_ID: planIds.yearly,
  });
  await query(
    "UPDATE professional_subscriptions SET status='none',customer_id=$2 WHERE user_id=$1",
    [owner.id, customerId],
  );
  const sessions = new Map<string, any>();
  const creations: { parameters: any; key: string }[] = [];
  const expirations: string[] = [];
  let failCreation = false;
  let failExpiration = false;
  let activePrice = prices[planIds.yearly];
  stripeClient.prices.retrieve = (async (id: string) => prices[id]) as any;
  stripeClient.checkout.sessions.retrieve = (async (id: string) =>
    sessions.get(id)) as any;
  stripeClient.checkout.sessions.create = (async (
    parameters: any,
    options: any,
  ) => {
    creations.push({ parameters, key: options.idempotencyKey });
    if (failCreation) {
      failCreation = false;
      throw new Error("test transport failure");
    }
    const id = "cs_plans_" + randomUUID();
    const session = {
      id,
      status: "open",
      customer: customerId,
      url: "https://checkout.stripe.com/test/" + id,
      line_items: {
        data: [{ price: prices[parameters.line_items[0].price], quantity: 1 }],
      },
    };
    sessions.set(id, session);
    return session;
  }) as any;
  stripeClient.checkout.sessions.expire = (async (id: string) => {
    if (failExpiration)
      throw new Error("test checkout was completed concurrently");
    expirations.push(id);
    const session = sessions.get(id);
    session.status = "expired";
    return session;
  }) as any;
  stripeClient.subscriptions.retrieve = (async () => ({
    id: "sub_plans_" + suffix,
    customer: customerId,
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        { quantity: 1, price: activePrice, current_period_end: 1800000000 },
      ],
    },
  })) as any;
  const app = express();
  app.use("/webhooks", webhooks);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.account = req.headers["x-test-user"] === customer.id ? customer : owner;
    next();
  });
  app.use("/subscription", subscriptions);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.status || 500).json({ error: "rejected" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const call = (path = "", body?: any, user = owner.id) =>
    fetch(base + "/subscription" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-test-user": user },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const sendWebhook = async () => {
    const payload = JSON.stringify({
      id: "evt_plans_" + randomUUID(),
      type: "customer.subscription.updated",
      data: { object: { id: "sub_plans_" + suffix, customer: customerId } },
    });
    return fetch(base + "/webhooks/stripe-subscriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeClient.webhooks.generateTestHeaderString({
          payload,
          secret: "whsec_subscription_fixture",
        }),
      },
      body: payload,
    });
  };
  try {
    const billing = await (await call()).json();
    assert.deepEqual(
      billing.plans.map((p: any) => [p.id, p.amount, p.months]),
      [
        ["monthly", 4000, 1],
        ["six_month", 21000, 6],
        ["yearly", 36000, 12],
      ],
    );
    assert.ok(!JSON.stringify(billing).includes("price_"));
    assert.equal((await call("/checkout", { plan: "unknown" })).status, 400);
    assert.equal(
      (await call("/checkout", { plan: "monthly" }, customer.id)).status,
      403,
    );
    await query("UPDATE profiles SET verified=false WHERE id=$1", [owner.id]);
    assert.equal((await call("/checkout", { plan: "monthly" })).status, 409);
    await query("UPDATE profiles SET verified=true WHERE id=$1", [owner.id]);
    const first = await (
      await call("/checkout", {
        plan: "monthly",
        priceId: planIds.yearly,
        amount: 1,
      })
    ).json();
    assert.equal(creations[0].parameters.line_items[0].price, planIds.monthly);
    assert.equal(
      creations[0].parameters.success_url,
      env.SITE_URL + "/app/subscription?checkout=processing",
    );
    assert.equal(
      creations[0].parameters.cancel_url,
      env.SITE_URL + "/app/subscription?checkout=canceled",
    );
    assert.equal(
      (await (await call("/checkout", { plan: "monthly" })).json()).url,
      first.url,
    );
    assert.equal(creations.length, 1, "same plan resumes its existing session");
    assert.equal((await call("/checkout", { plan: "six_month" })).status, 200);
    assert.equal(
      creations[1].parameters.line_items[0].price,
      planIds.six_month,
    );
    assert.equal(expirations.length, 1);
    assert.notEqual(creations[0].key, creations[1].key);
    failExpiration = true;
    assert.equal((await call("/checkout", { plan: "yearly" })).status, 409);
    assert.equal(
      creations.length,
      2,
      "concurrent completion never creates another checkout",
    );
    failExpiration = false;
    failCreation = true;
    assert.equal((await call("/checkout", { plan: "yearly" })).status, 500);
    assert.equal((await call("/checkout", { plan: "yearly" })).status, 200);
    assert.equal(
      creations[2].key,
      creations[3].key,
      "failed creation retries the same parameters and idempotency key",
    );
    assert.equal(creations[3].parameters.line_items[0].price, planIds.yearly);
    assert.equal(
      (await (await call()).json()).status,
      "none",
      "checkout does not grant membership",
    );
    for (const id of Object.values(planIds)) {
      activePrice = prices[id];
      assert.equal((await sendWebhook()).status, 200);
      const state = await (await call()).json();
      assert.equal(state.status, "active");
      assert.equal(state.currentPlan.amount, activePrice.unit_amount);
      assert.equal(state.periodEnd, new Date(1800000000 * 1000).toISOString());
    }
    assert.equal(
      (await call("/checkout", { plan: "monthly" })).status,
      409,
      "existing subscriptions use Manage billing",
    );
    activePrice = { ...prices[planIds.yearly], unit_amount: 1 };
    assert.equal((await sendWebhook()).status, 200);
    assert.equal((await (await call()).json()).status, "unrecognized_price");
    env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_missing_catalog_" + suffix;
    const unavailable = await (await call()).json();
    assert.deepEqual(unavailable.plans, []);
    assert.equal(
      unavailable.canManage,
      true,
      "catalog failure must not block existing billing management",
    );
    assert.ok(unavailable.pricingProblem);
  } finally {
    Object.assign(env, oldEnv);
    stripeClient.prices.retrieve = oldPrices;
    stripeClient.checkout.sessions.retrieve = oldRetrieve;
    stripeClient.checkout.sessions.create = oldCreate;
    stripeClient.checkout.sessions.expire = oldExpire;
    stripeClient.subscriptions.retrieve = oldSubscription;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
