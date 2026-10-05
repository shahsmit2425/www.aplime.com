import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
process.env.STRIPE_PRO_PRICE_ID = "price_test_pro";
process.env.STRIPE_SECRET_KEY = "sk_test_unit_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_fixture";
process.env.MARKETPLACE_DISCOVERY_MODE = "matched";
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
