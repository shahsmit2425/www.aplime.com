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
  const proposedAt = new Date(Date.now() + 86400000).toISOString();
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
  await assert.rejects(projectAction(id, customer, { type: "start" }));
  await projectAction(id, professional, { type: "start" });
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
test("approved professionals can discover and quote open projects in every category", async () => {
  const id = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      customer.id,
      "Cross-category project",
      "A cleaning project outside the professional's saved category and ZIP.",
      "Cleaning",
      "90210",
    ],
  );
  const available = await workspace(professional);
  assert.ok(available.leads.some((project) => project.id === id));
  await projectAction(id, professional, {
    type: "quote",
    laborAmount: 10000,
    materialsAmount: 2500,
    description: "Complete scope after confirming the project details.",
    exclusions: "Specialty materials",
    timeline: "One day",
    expiresAt: null,
  });
  const quoteCount = (
    await query(
      "SELECT count(*)::int AS n FROM quotes WHERE project_id=$1 AND pro_id=$2",
      [id, professional.id],
    )
  ).rows[0] as { n: number };
  assert.equal(quoteCount.n, 1);
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
        "Cross-category conversation",
        "An electrical project available for a private professional question.",
        "Electrical",
        "60601",
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
