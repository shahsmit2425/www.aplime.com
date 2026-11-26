import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { DecodedIdToken } from "firebase-admin/auth";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "fixture-access-key";
process.env.R2_SECRET_ACCESS_KEY = "fixture-secret";
process.env.R2_BUCKET = "fixture-bucket";
process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
const { pool } = await import("../src/server/db/index.js");
const { adminConsole } = await import("../src/server/admin-console.js");
const { discussions } = await import("../src/server/discussions.js");
const { supportRouter } = await import("../src/server/support.js");
const { assertAdmin } = await import("../src/server/admin-policy.js");
const { stripe } = await import("../src/server/integrations/stripe.js");
const db = new PGlite();
const query = async (sql: string, params?: unknown[]) => {
  const result = await db.query(sql, params);
  return { ...result, rowCount: result.affectedRows || result.rows.length };
};
pool.query = query as typeof pool.query;
pool.connect = (async () => ({
  query,
  release() {},
})) as unknown as typeof pool.connect;
for (const file of (await readdir("src/server/db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("src/server/db/migrations/" + file, "utf8"));
const accounts = {
  admin: {
    id: "approved-admin",
    name: "Owner",
    email: "admin@example.invalid",
    role: "admin" as const,
    settings: {},
  },
  customer: {
    id: "customer-a",
    name: "First customer",
    email: "customer@example.invalid",
    role: "customer" as const,
    settings: {},
  },
  pro: {
    id: "pro-a",
    name: "First pro",
    email: "pro@example.invalid",
    role: "pro" as const,
    settings: {},
  },
  outsider: {
    id: "customer-b",
    name: "Other customer",
    email: "other@example.invalid",
    role: "customer" as const,
    settings: {},
  },
};
for (const a of Object.values(accounts))
  await query("INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)", [
    a.id,
    a.name,
    a.email,
    a.role,
  ]);
const project = randomUUID(),
  discussion = randomUUID(),
  image = randomUUID(),
  file = randomUUID(),
  payment = randomUUID();
await query(
  "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,address,listed,weekly_hours) VALUES($1,'Careful business','Cleaning','Long business description','10001',50,true,'approved','Private business base',true,'{\"Mon\":{\"start\":\"08:00\",\"end\":\"17:00\"}}')",
  [accounts.pro.id],
);
await query(
  "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
  [accounts.pro.id],
);
await query(
  "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,status,address,intake) VALUES($1,$2,$3,'Detailed project','Sensitive project description','Cleaning','10001','completed','Private project address','{\"rooms\":\"3\"}')",
  [project, accounts.customer.id, accounts.pro.id],
);
await query(
  "INSERT INTO payments(id,project_id,amount,status,intent_id) VALUES($1,$2,15000,'paid','pi_test_fixture')",
  [payment, project],
);
await query(
  "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3)",
  [discussion, project, accounts.pro.id],
);
await query(
  "INSERT INTO discussion_messages(id,discussion_id,sender_id,body) VALUES($1,$2,$3,'Sensitive conversation content')",
  [randomUUID(), discussion, accounts.customer.id],
);
await query(
  "INSERT INTO business_images(id,profile_id,slot,object_key,name,content_type,size,status) VALUES($1,$2,'logo','private/business/logo','Logo','image/png',12,'ready')",
  [image, accounts.pro.id],
);
await query(
  "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size,status) VALUES($1,$2,$3,'private/project/file','Project file','image/png',12,'ready')",
  [file, project, accounts.customer.id],
);
await query(
  "INSERT INTO call_events(id,project_id,discussion_id,actor_id,mode) VALUES($1,$2,$3,$4,'video')",
  [randomUUID(), project, discussion, accounts.customer.id],
);
const app = express();
app.use(express.json());
// Test-only identity injection. Production still verifies signed Firebase tokens in api.ts.
app.use((req, res, next) => {
  const key = req.headers["x-fixture-actor"] as keyof typeof accounts;
  if (!accounts[key]) return res.status(401).json({ error: "Sign in" });
  req.account = accounts[key];
  next();
});
app.use("/admin", (req, _res, next) => {
  assertAdmin(
    {
      uid: req.account.id,
      admin: true,
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_second_factor: "totp" },
    } as unknown as DecodedIdToken,
    req.account,
    [accounts.admin.id],
  );
  next();
});
app.use("/admin", adminConsole);
app.use("/admin/support", supportRouter(true));
app.use("/support", supportRouter(false));
app.use(discussions);
app.use(
  (
    e: { status?: number; message: string; name?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) =>
    res
      .status(e.status || (e.name === "ZodError" ? 400 : 500))
      .json({ error: e.message }),
);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
async function call(
  path: string,
  actor: keyof typeof accounts = "admin",
  body?: unknown,
) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-fixture-actor": actor, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
  await pool.end();
});
test("admin overview uses full database counts and produces a bounded 30-day trend", async () => {
  const r = await call("/admin/overview");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.totals.users, 3);
  assert.equal(data.totals.projects, 1);
  assert.equal(data.totals.completed, 1);
  assert.equal(data.totals.callInvitations, 1);
  assert.equal(data.trend.length, 30);
  assert.equal(data.trend.at(-1).messages, 1);
  assert.ok(!JSON.stringify(data).includes("Sensitive conversation content"));
});
test("all collections support validated search, status and pagination", async () => {
  for (const path of [
    "users",
    "professionals",
    "identity",
    "memberships",
    "projects",
    "payments",
    "audit",
  ]) {
    const r = await call("/admin/" + path);
    assert.equal(r.status, 200, path);
    assert.equal((await r.json()).pageSize, 25);
  }
  const payments = await (await call("/admin/payments?status=paid")).json();
  assert.equal(payments.total, 1);
  assert.equal(payments.rows[0].id, payment);
  assert.equal(payments.rows[0].customerName, accounts.customer.name);
  const filtered = await (await call("/admin/users?q=First&status=pro")).json();
  assert.equal(filtered.total, 1);
  assert.equal(filtered.rows[0].id, accounts.pro.id);
  assert.equal((await call("/admin/users?page=-1")).status, 400);
  assert.equal((await call("/admin/projects?status=cancelled")).status, 200);
  const related = await (
    await call("/admin/projects?userId=" + accounts.pro.id)
  ).json();
  assert.equal(related.total, 1);
  for (let i = 0; i < 27; i++)
    await query(
      "INSERT INTO audit_log(id,actor_id,action,entity_id) VALUES($1,$2,'pagination_fixture','entity')",
      [randomUUID(), accounts.admin.id],
    );
  const second = await (
    await call("/admin/audit?status=pagination_fixture&page=2")
  ).json();
  assert.equal(second.total, 27);
  assert.equal(second.rows.length, 2);
});
test("private details, transcripts and file signatures require administrator policy and are audited", async () => {
  for (const path of [
    "/admin/users/" + accounts.pro.id,
    "/admin/projects/" + project,
    "/admin/payments/" + payment,
    "/admin/conversations/" + discussion,
    "/admin/files/" + file,
  ])
    for (const actor of ["customer", "pro", "outsider"] as const)
      assert.equal((await call(path, actor)).status, 403);
  const detail = await (await call("/admin/users/" + accounts.pro.id)).json();
  assert.equal(detail.profile.address, "Private business base");
  assert.equal(detail.profile.images[0].id, image);
  assert.ok(detail.profile.images[0].url.includes("X-Amz-Signature"));
  assert.ok(!JSON.stringify(detail).includes('"key":'));
  const p = await (await call("/admin/projects/" + project)).json();
  assert.equal(p.project.address, "Private project address");
  assert.equal(p.project.intake.rooms, "3");
  const pay = await (await call("/admin/payments/" + payment)).json();
  assert.equal(pay.payment.amount, 15000);
  assert.equal(pay.payment.status, "paid");
  assert.equal(pay.payment.projectId, project);
  assert.equal(pay.payment.customerName, accounts.customer.name);
  assert.equal((await call("/admin/payments/" + randomUUID())).status, 404);
  const transcript = await (
    await call("/admin/conversations/" + discussion)
  ).json();
  assert.equal(transcript.rows[0].body, "Sensitive conversation content");
  const signed = await (await call("/admin/files/" + file)).json();
  assert.ok(signed.url.includes("X-Amz-Expires=120"));
  assert.ok(signed.previewUrl.includes("X-Amz-Expires=120"));
  assert.ok(signed.previewUrl.includes("response-content-type=image%2Fpng"));
  await query("UPDATE uploads SET content_type='image/svg+xml' WHERE id=$1", [
    file,
  ]);
  assert.equal(
    (await (await call("/admin/files/" + file)).json()).previewUrl,
    null,
  );
  await query("UPDATE uploads SET content_type='image/png' WHERE id=$1", [
    file,
  ]);
  assert.ok(!("objectKey" in signed));
  for (const kind of [
    "files",
    "conversations",
    "calls",
    "reviews",
    "estimates",
    "activity",
    "legacy",
  ])
    assert.equal(
      (await call(`/admin/projects/${project}/records/${kind}`)).status,
      200,
    );
  const log = (
    await query("SELECT action FROM audit_log WHERE actor_id=$1", [
      accounts.admin.id,
    ])
  ).rows as { action: string }[];
  for (const action of [
    "admin_user_read",
    "admin_project_read",
    "admin_conversation_read",
    "admin_file_access",
  ])
    assert.ok(log.some((r) => r.action === action));
  assert.equal((await call("/admin/files/" + randomUUID())).status, 404);
});
test("interaction relationships aggregate actual activity without exposing message content", async () => {
  assert.equal((await call("/admin/interactions", "customer")).status, 403);
  const response = await call("/admin/interactions?userId=" + accounts.pro.id);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.rows[0].customerId, accounts.customer.id);
  assert.equal(data.rows[0].proId, accounts.pro.id);
  assert.equal(data.rows[0].messages, 1);
  assert.equal(data.rows[0].projects, 1);
  assert.equal(data.rows[0].conversations, 1);
  assert.equal(data.rows[0].callInvitations, 1);
  assert.ok(!JSON.stringify(data).includes("Sensitive conversation content"));
  assert.equal(
    (
      await (
        await call("/admin/interactions?userId=" + accounts.outsider.id)
      ).json()
    ).total,
    0,
  );
  assert.equal(
    (await (await call("/admin/interactions?q=Careful")).json()).total,
    1,
  );
  assert.equal(
    (await (await call("/admin/interactions?q=nonexistent")).json()).total,
    0,
  );
  assert.equal((await call("/admin/interactions?page=0")).status, 400);
});
test("admin identity and billing return selected Stripe fields without document secrets or granting state", async () => {
  await query(
    "UPDATE profiles SET identity_session_id='vs_fixture',verified=false WHERE id=$1",
    [accounts.pro.id],
  );
  const original = stripe().identity.verificationSessions.retrieve;
  stripe().identity.verificationSessions.retrieve = (async () => ({
    id: "vs_fixture",
    status: "processing",
    livemode: false,
    created: 1700000000,
    client_secret: "NEVER_RETURN",
    verified_outputs: { first_name: "PRIVATE" },
    last_error: { code: "document_expired" },
  })) as unknown as typeof original;
  try {
    const r = await call(`/admin/users/${accounts.pro.id}/identity`);
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.status, "processing");
    assert.equal(data.verified, false);
    assert.ok(!JSON.stringify(data).includes("NEVER_RETURN"));
    assert.ok(!JSON.stringify(data).includes("PRIVATE"));
  } finally {
    stripe().identity.verificationSessions.retrieve = original;
  }
  const billing = await (
    await call(`/admin/users/${accounts.pro.id}/billing`)
  ).json();
  assert.equal(billing.status, "active");
  assert.equal(billing.plan, null);
  const retrieve = stripe().subscriptions.retrieve;
  await query(
    "UPDATE professional_subscriptions SET subscription_id='sub_fixture',customer_id='cus_fixture' WHERE user_id=$1",
    [accounts.pro.id],
  );
  stripe().subscriptions.retrieve = (async () => ({
    customer: "cus_wrong",
    status: "active",
  })) as unknown as typeof retrieve;
  try {
    assert.equal(
      (await call(`/admin/users/${accounts.pro.id}/billing`)).status,
      503,
    );
    stripe().subscriptions.retrieve = (async () => {
      throw new Error("provider error containing sensitive data");
    }) as unknown as typeof retrieve;
    const failed = await call(`/admin/users/${accounts.pro.id}/billing`);
    assert.equal(failed.status, 503);
    assert.ok(!(await failed.text()).includes("sensitive data"));
  } finally {
    stripe().subscriptions.retrieve = retrieve;
    await query(
      "UPDATE professional_subscriptions SET subscription_id=NULL,customer_id=NULL WHERE user_id=$1",
      [accounts.pro.id],
    );
  }
});
test("support ownership, two-way notifications, retry deduplication and reopen are enforced", async () => {
  const r = await call("/support/conversations", "customer", {
    subject: "Please help me",
    body: "I need help with my business account.",
  });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal(
    (await call("/support/conversations/" + id, "outsider")).status,
    404,
  );
  const message = { body: "We can help you here.", clientKey: randomUUID() };
  assert.equal(
    (
      await call(
        `/admin/support/conversations/${id}/messages`,
        "admin",
        message,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/admin/support/conversations/${id}/messages`,
        "admin",
        message,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`/admin/support/conversations/${id}/messages`, "admin", {
        ...message,
        body: "Changed message",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/support/conversations/${id}/messages`, "outsider", {
        body: "Intrusion",
        clientKey: randomUUID(),
      })
    ).status,
    404,
  );
  const mine = await (
    await call("/support/conversations/" + id, "customer")
  ).json();
  assert.equal(mine.total, 1);
  assert.equal(mine.messages[0].senderRole, "admin");
  assert.equal(
    (
      await call(`/support/conversations/${id}/messages`, "customer", {
        body: "Thank you support.",
        clientKey: randomUUID(),
      })
    ).status,
    200,
  );
  await query(
    "UPDATE tickets SET status='resolved',resolution='Issue resolved' WHERE id=$1",
    [id],
  );
  assert.equal(
    (
      await call(`/support/conversations/${id}/messages`, "customer", {
        body: "Another reply",
        clientKey: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await call(`/support/conversations/${id}/reopen`, "outsider", {})).status,
    404,
  );
  assert.equal(
    (await call(`/support/conversations/${id}/reopen`, "customer", {})).status,
    200,
  );
  const notices = (
    await query(
      "SELECT * FROM notifications WHERE user_id=$1 AND target_page='messages'",
      [accounts.customer.id],
    )
  ).rows as any[];
  assert.equal(notices.length, 1);
  assert.equal(notices[0].target_id, "support:" + id);
  assert.ok(!notices[0].body.includes(message.body));
  const adminNotice = (
    await query(
      "SELECT target_id FROM notifications WHERE user_id=$1 AND target_page='support'",
      [accounts.admin.id],
    )
  ).rows;
  assert.ok(adminNotice.some((r: any) => r.target_id === id));
  const reopenCount = (
    await query(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='support_reopen' AND entity_id=$1",
      [id],
    )
  ).rows[0] as { n: number };
  await call(`/support/conversations/${id}/reopen`, "customer", {});
  assert.equal(
    (
      (
        await query(
          "SELECT count(*)::int AS n FROM audit_log WHERE action='support_reopen' AND entity_id=$1",
          [id],
        )
      ).rows[0] as { n: number }
    ).n,
    reopenCount.n,
  );
  const onlyMine = await (
    await call("/support/conversations", "outsider")
  ).json();
  assert.equal(onlyMine.total, 0);
});
test("an administrator can initiate support without impersonating the user", async () => {
  const r = await call("/admin/support/conversations", "admin", {
    userId: accounts.pro.id,
    subject: "Listing review help",
    body: "We can help you complete your listing.",
  });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const thread = await (
    await call("/support/conversations/" + id, "pro")
  ).json();
  assert.equal(thread.ticket.openedByName, "Owner");
  assert.equal(thread.ticket.userId, accounts.pro.id);
  assert.equal(
    (
      await call("/admin/support/conversations", "pro", {
        userId: accounts.customer.id,
        subject: "Forged admin role",
        body: "This must never be accepted.",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/support/conversations", "customer", {
        userId: accounts.outsider.id,
        subject: "Forged owner field",
        body: "This must never be accepted.",
      })
    ).status,
    400,
  );
});
test("admin messages reach the user inbox and acknowledgements preserve concurrent replies", async () => {
  const created = await call("/admin/support/conversations", "admin", {
    userId: accounts.customer.id,
    subject: "Account setup assistance",
    body: "Hello, we are here to help with your account.",
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const list = await (await call("/support/conversations", "customer")).json();
  const conversation = list.rows.find((t: any) => t.id === id);
  assert.equal(
    conversation.lastMessage,
    "Hello, we are here to help with your account.",
  );
  assert.equal(conversation.unreadCount, 1);
  assert.equal(conversation.openedBy, accounts.admin.id);
  assert.equal(
    (await (await call("/support/conversations", "pro")).json()).rows.some(
      (t: any) => t.id === id,
    ),
    false,
  );
  const snapshot = await (
    await call("/support/conversations/" + id, "customer")
  ).json();
  assert.equal(snapshot.ticket.body, conversation.lastMessage);
  const ack = { noticeIds: snapshot.ticket.unreadNoticeIds };
  await call(`/admin/support/conversations/${id}/messages`, "admin", {
    body: "A second message arrived while you read the first.",
    clientKey: randomUUID(),
  });
  assert.equal(
    (await call(`/support/conversations/${id}/read`, "outsider", ack)).status,
    404,
  );
  assert.equal(
    (await call(`/support/conversations/${id}/read`, "customer", ack)).status,
    200,
  );
  const latest = await (
    await call(`/support/conversations/${id}`, "customer")
  ).json();
  assert.equal(latest.ticket.unreadCount, 1);
  assert.equal(
    latest.messages[0].body,
    "A second message arrived while you read the first.",
  );
  const unrelated = (
    await query(
      "SELECT id FROM notifications WHERE user_id=$1 AND NOT read AND target_id!=$2 LIMIT 1",
      [accounts.customer.id, "support:" + id],
    )
  ).rows[0] as { id: string };
  assert.ok(unrelated);
  await call(`/support/conversations/${id}/read`, "customer", {
    noticeIds: [...latest.ticket.unreadNoticeIds, unrelated.id],
  });
  assert.equal(
    (
      (
        await query("SELECT read FROM notifications WHERE id=$1", [
          unrelated.id,
        ])
      ).rows[0] as any
    ).read,
    false,
  );
  assert.equal(
    (await (await call(`/support/conversations/${id}`, "customer")).json())
      .ticket.unreadCount,
    0,
  );
  const legacyId = randomUUID();
  await query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) VALUES($1,$2,'Legacy support update','Open support','help',$3)",
    [legacyId, accounts.customer.id, id],
  );
  assert.equal(
    (await (await call(`/support/conversations/${id}`, "customer")).json())
      .ticket.unreadCount,
    1,
  );
  await call(`/support/conversations/${id}/read`, "customer", {
    noticeIds: [legacyId],
  });
  await call(`/support/conversations/${id}/messages`, "customer", {
    body: "I received your messages, thanks.",
    clientKey: randomUUID(),
  });
  const admin = await (await call(`/admin/support/conversations/${id}`)).json();
  assert.equal(admin.ticket.unreadCount, 1);
  assert.equal(admin.messages.at(-1).body, "I received your messages, thanks.");
  await call(`/admin/support/conversations/${id}/read`, "admin", {
    noticeIds: admin.ticket.unreadNoticeIds,
  });
  assert.equal(
    (await (await call(`/admin/support/conversations/${id}`)).json()).ticket
      .unreadCount,
    0,
  );
});
test("project chat unread state is participant-scoped and preserves a concurrent reply", async () => {
  const notice = randomUUID(),
    later = randomUUID();
  await query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) VALUES($1,$2,'New project message','Open chat','messages',$3)",
    [notice, accounts.customer.id, discussion],
  );
  const threads = await (await call("/discussions", "customer")).json();
  const current = threads.find((t: any) => t.id === discussion);
  assert.ok(current.unread_notice_ids.includes(notice));
  assert.equal(current.messages[0].body, "Sensitive conversation content");
  await query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) VALUES($1,$2,'New project message','Open chat','messages',$3)",
    [later, accounts.customer.id, discussion],
  );
  assert.equal(
    (
      await call(`/discussions/${discussion}/read`, "outsider", {
        noticeIds: [notice, later],
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call(`/discussions/${discussion}/read`, "customer", {
        noticeIds: current.unread_notice_ids,
      })
    ).status,
    200,
  );
  const unread = (await (await call("/discussions", "customer")).json()).find(
    (t: any) => t.id === discussion,
  );
  assert.equal(unread.unread_count, 1);
  assert.deepEqual(unread.unread_notice_ids, [later]);
  assert.deepEqual(await (await call("/discussions", "outsider")).json(), []);
});

test("administrator notification history is paginated and scoped to the signed-in operator", async () => {
  const r = await call("/admin/notifications?page=1");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.total > 0);
  assert.ok(data.rows.every((n: any) => n.targetPage === "support"));
  assert.equal((await call("/admin/notifications", "outsider")).status, 403);
  assert.equal(
    (await call("/admin/notifications?userId=customer-a")).status,
    200,
  );
  const scoped = await (
    await call("/admin/notifications?userId=customer-a")
  ).json();
  assert.equal(scoped.total, data.total);
});
test("platform settings are validated, audited with a reason and applied at runtime", async () => {
  const { platformSettings, assertNotPaused } =
    await import("../src/server/platform-settings.js");
  const setting = (data: any, key: string) =>
    data.settings.find((s: any) => s.key === key);
  const reason = "Testing a runtime change";
  assert.equal((await call("/admin/platform", "customer")).status, 403);
  const initial = await (await call("/admin/platform")).json();
  assert.equal(setting(initial, "projectsPerDay").value, 10);
  assert.equal(setting(initial, "pauseProjectSubmissions").value, false);
  assert.equal(setting(initial, "projectsPerDay").updatedAt, null);
  for (const body of [
    { key: "projectsPerDay", value: 3 },
    { key: "projectsPerDay", value: 3, reason: "short" },
    { key: "projectsPerDay", value: 0, reason },
    { key: "projectsPerDay", value: 101, reason },
    { key: "projectsPerDay", value: 2.5, reason },
    { key: "projectsPerDay", value: true, reason },
    { key: "pauseProjectSubmissions", value: 1, reason },
    { key: "unknownSetting", value: 1, reason },
  ])
    assert.equal(
      (await call("/admin/platform", "admin", body)).status,
      400,
      JSON.stringify(body),
    );
  const change = { key: "projectsPerDay", value: 3, reason };
  assert.equal((await call("/admin/platform", "customer", change)).status, 403);
  assert.equal((await platformSettings()).projectsPerDay, 10);
  assert.equal((await call("/admin/platform", "admin", change)).status, 200);
  assert.equal((await call("/admin/platform", "admin", change)).status, 409);
  assert.equal((await platformSettings()).projectsPerDay, 3);
  await assertNotPaused("pauseProjectSubmissions");
  const pause = { key: "pauseProjectSubmissions", value: true, reason };
  assert.equal((await call("/admin/platform", "admin", pause)).status, 200);
  await assert.rejects(assertNotPaused("pauseProjectSubmissions"), {
    status: 503,
  });
  const after = await (await call("/admin/platform")).json();
  assert.equal(setting(after, "projectsPerDay").value, 3);
  assert.equal(setting(after, "projectsPerDay").updatedBy, accounts.admin.name);
  assert.equal(setting(after, "pauseProjectSubmissions").value, true);
  assert.equal(after.history.length, 2);
  assert.equal(after.history[0].reason, reason);
  const logged = (
    await query(
      "SELECT before,after,reason FROM audit_log WHERE action='update_setting' AND entity_id='projectsPerDay'",
    )
  ).rows as any[];
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0].before, { value: 10 });
  assert.deepEqual(logged[0].after, { value: 3 });
  assert.equal(logged[0].reason, reason);
  for (const restore of [
    { ...pause, value: false },
    { ...change, value: 10 },
  ])
    assert.equal((await call("/admin/platform", "admin", restore)).status, 200);
  await assertNotPaused("pauseProjectSubmissions");
  assert.equal((await platformSettings()).projectsPerDay, 10);
});
test("account suspension, forced sign-out, notes and timeline are administrator-only and audited", async () => {
  const pro = "/admin/users/" + accounts.pro.id;
  const reason = "Repeated policy violations";
  for (const [path, body] of [
    ["/suspension", { suspended: true, reason }],
    ["/revoke-sessions", { reason }],
    ["/notes", { body: "Internal note" }],
    ["/timeline", undefined],
  ] as const)
    assert.equal((await call(pro + path, "customer", body)).status, 403, path);
  assert.equal(
    (await call(pro + "/suspension", "admin", { suspended: true })).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/users/${accounts.admin.id}/suspension`, "admin", {
        suspended: true,
        reason,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/admin/users/missing/suspension", "admin", {
        suspended: true,
        reason,
      })
    ).status,
    404,
  );
  const suspend = { suspended: true, reason };
  assert.equal((await call(pro + "/suspension", "admin", suspend)).status, 200);
  assert.equal((await call(pro + "/suspension", "admin", suspend)).status, 409);
  const state = async () =>
    (
      await query(
        "SELECT u.suspended_at,u.suspension_reason,u.sessions_revoked_at,p.suspended,p.suspension_note FROM users u JOIN profiles p ON p.id=u.id WHERE u.id=$1",
        [accounts.pro.id],
      )
    ).rows[0] as any;
  let row = await state();
  assert.ok(row.suspended_at);
  assert.equal(row.suspension_reason, reason);
  assert.equal(row.suspended, true);
  assert.equal(row.suspension_note, reason);
  const detail = await (await call(pro)).json();
  assert.ok(detail.user.suspendedAt);
  assert.equal(detail.user.suspensionReason, reason);
  const listed = await (await call("/admin/users?q=First&status=pro")).json();
  assert.equal(listed.rows[0].suspended, true);
  assert.equal(
    (
      await call(pro + "/suspension", "admin", {
        suspended: false,
        reason: "Appeal accepted after review",
      })
    ).status,
    200,
  );
  row = await state();
  assert.equal(row.suspended_at, null);
  assert.equal(row.suspension_reason, null);
  // Marketplace access stays suspended until an administrator restores it separately.
  assert.equal(row.suspended, true);
  const revoked = await call(pro + "/revoke-sessions", "admin", { reason });
  assert.equal(revoked.status, 200);
  // Firebase is not configured in tests, so only the stored revocation applies.
  assert.deepEqual(await revoked.json(), { ok: true, providerRevoked: false });
  assert.ok((await state()).sessions_revoked_at);
  assert.equal(
    (await call(pro + "/notes", "admin", { body: "  " })).status,
    400,
  );
  assert.equal(
    (await call(pro + "/notes", "admin", { body: "Called the owner today." }))
      .status,
    200,
  );
  const noted = await (await call(pro)).json();
  assert.equal(noted.notes.length, 1);
  assert.equal(noted.notes[0].body, "Called the owner today.");
  assert.equal(noted.notes[0].author, accounts.admin.name);
  const timeline = await (await call(pro + "/timeline")).json();
  const summaries = timeline.rows.map((r: any) => r.summary);
  assert.equal(timeline.pageSize, 25);
  assert.ok(summaries.includes("Account created"));
  assert.ok(summaries.includes("account_suspended: " + reason));
  assert.ok(summaries.includes("account_sessions_revoked: " + reason));
  assert.ok(!summaries.some((s: string) => s.startsWith("admin_")));
  assert.ok(!JSON.stringify(timeline).includes("Called the owner today."));
  const customerTimeline = await (
    await call(`/admin/users/${accounts.customer.id}/timeline`)
  ).json();
  const posted = customerTimeline.rows.find(
    (r: any) => r.summary === "Posted project: Detailed project",
  );
  assert.equal(posted.projectId, project);
  assert.equal((await call("/admin/users/missing/timeline")).status, 404);
  const actions = (
    await query(
      "SELECT action,reason FROM audit_log WHERE entity_id=$1 AND actor_id=$2",
      [accounts.pro.id, accounts.admin.id],
    )
  ).rows as { action: string; reason: string | null }[];
  for (const action of [
    "account_suspended",
    "account_restored",
    "account_sessions_revoked",
    "admin_note_added",
    "admin_user_timeline_read",
  ])
    assert.ok(
      actions.some((a) => a.action === action),
      action,
    );
  assert.equal(
    actions.find((a) => a.action === "account_suspended")!.reason,
    reason,
  );
});
test("system health reports queue depths and configuration presence without secret values", async () => {
  assert.equal((await call("/admin/health", "customer")).status, 403);
  const r = await call("/admin/health");
  assert.equal(r.status, 200);
  const body = await r.text();
  const data = JSON.parse(body);
  assert.equal(data.database.status, "ok");
  assert.equal(data.liveUpdates.status, "not_configured");
  assert.equal(data.queues.emailFailed, 0);
  assert.equal(typeof data.queues.emailPending, "number");
  assert.equal(data.configured.payments, true);
  assert.equal(data.configured.fileStorage, true);
  assert.ok(!body.includes("sk_test_fixture"));
  assert.ok(!body.includes("fixture-secret"));
});
