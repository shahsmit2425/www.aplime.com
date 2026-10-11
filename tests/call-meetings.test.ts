import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { callCanJoin, callIsActive } from "../src/shared/meetings.js";
process.env.MARKETPLACE_DISCOVERY_MODE = "matched";
process.env.MARKETPLACE_PREVIEW = "false";
const { pool, transaction } = await import("../src/server/db/index.js");
const { callMeetings } = await import("../src/server/call-meetings.js");
const { assertAppointment } = await import("../src/server/scheduling.js");
const { env } = await import("../src/server/config.js");
const db = new PGlite();
for (const file of (await readdir("src/server/db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("src/server/db/migrations/" + file, "utf8"));
const query = async (sql: string, values?: unknown[]) => {
  const r = await db.query<any>(sql, values);
  return { ...r, rowCount: r.affectedRows || r.rows.length };
};
pool.query = query as typeof pool.query;
pool.connect = (async () => ({
  query,
  release() {},
})) as unknown as typeof pool.connect;
const users = [
  {
    id: "customer",
    email: "customer@example.invalid",
    name: "Customer",
    role: "customer",
    settings: {},
  },
  {
    id: "other",
    email: "other@example.invalid",
    name: "Other",
    role: "customer",
    settings: {},
  },
  {
    id: "pro",
    email: "pro@example.invalid",
    name: "Professional",
    role: "pro",
    settings: {},
  },
  {
    id: "second-pro",
    email: "second@example.invalid",
    name: "Second professional",
    role: "pro",
    settings: {},
  },
] as const;
for (const u of users)
  await query("INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,$4)", [
    u.id,
    u.email,
    u.name,
    u.role,
  ]);
const hours = Object.fromEntries(
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => [
    d,
    { start: "00:00", end: "23:59" },
  ]),
);
for (const u of users.filter((u) => u.role === "pro")) {
  await query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,verified,review_status,weekly_hours,time_zone,service_categories) VALUES($1,'Business','Cleaning','A genuine test fixture','10001',40,true,'approved',$2,'UTC','[\"Cleaning\"]')",
    [u.id, JSON.stringify(hours)],
  );
  await query(
    "INSERT INTO professional_subscriptions(user_id,status) VALUES($1,'active')",
    [u.id],
  );
}
const app = express();
app.use(express.json());
// This test-only harness supplies known actors; the real API auth boundary is tested separately.
app.use((q, _r, next) => {
  q.account = users.find((u) => u.id === q.headers["x-user"])!;
  next();
});
app.use(callMeetings);
app.use((e: any, _q: any, r: any, _n: any) =>
  r.status(e.status || 400).json({ error: e.message }),
);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (user: string, path: string, body?: object) => {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "x-user": user, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
};
const row = async (id: string) =>
  (await query("SELECT * FROM scheduled_calls WHERE id=$1", [id])).rows[0];
const project = async (customer = "customer", pro: string | null = null) => {
  const id = randomUUID();
  await query(
    "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip) VALUES($1,$2,$3,'Kitchen project','Clean the kitchen thoroughly','Cleaning','10001')",
    [id, customer, pro],
  );
  return id;
};
const slot = (offset = 0) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 2);
  t.setUTCHours(10, 0, 0, 0);
  return new Date(+t + offset * 30 * 60000).toISOString();
};
const create = async (
  p: string,
  time = slot(),
  user = "customer",
  proId = "pro",
) => {
  const id = randomUUID();
  const b = { id, projectId: p, proId, startsAt: time, mode: "video" };
  const r = await call(user, "/call-meetings", b);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { id, b };
};
const act = (user: string, id: string, body: object, version: number) =>
  call(user, `/call-meetings/${id}/actions`, {
    ...body,
    expectedVersion: version,
  });
test.beforeEach(async () => {
  await query(
    "UPDATE scheduled_calls SET status='cancelled',proposed_at=NULL,proposed_by=NULL WHERE status IN ('requested','confirmed')",
  );
});
test.after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
  await pool.end();
});

test("call request is private, idempotent, linked to the project and notifies the other user", async () => {
  const p = await project(),
    { id, b } = await create(p);
  assert.equal((await call("customer", "/call-meetings", b)).status, 200);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM notifications WHERE target_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await query("SELECT action FROM project_activity WHERE project_id=$1", [
        p,
      ])
    ).rows[0].action,
    "call_requested",
  );
  assert.equal(
    (await query("SELECT 1 FROM project_discussions WHERE project_id=$1", [p]))
      .rowCount,
    1,
  );
  assert.equal((await call("other", "/call-meetings")).body.length, 0);
  assert.equal((await act("other", id, { type: "cancel" }, 1)).status, 404);
  assert.equal(
    (await call("other", `/call-meetings/${id}/join`, {})).status,
    404,
  );
  assert.equal(
    (await call("other", `/projects/${p}/professionals/pro/call-slots`)).status,
    404,
  );
  assert.equal(
    (await act("customer", id, { type: "respond", accept: true }, 1)).status,
    403,
  );
  assert.equal(
    (await call("customer", `/call-meetings/${id}/join`, {})).status,
    409,
  );
  const realNow = Date.now;
  Date.now = () => Date.parse(b.startsAt) - 5 * 60000;
  try {
    assert.equal(
      (await act("pro", id, { type: "respond", accept: true }, 1)).status,
      200,
      "the recipient may confirm a future call even within its final 15 minutes",
    );
  } finally {
    Date.now = realNow;
  }
  assert.equal((await row(id)).status, "confirmed");
  assert.equal((await act("customer", id, { type: "cancel" }, 1)).status, 409);
  assert.equal(
    (await act("customer", id, { type: "complete" }, 2)).status,
    409,
  );
  assert.equal((await act("pro", id, { type: "cancel" }, 2)).status, 200);
  assert.equal((await row(id)).status, "cancelled");
});

test("availability and acceptance prevent pro/customer overlaps with calls and site visits", async () => {
  const p = await project(),
    pOther = await project("other"),
    pSecond = await project(),
    time = slot(4);
  const a = await create(p, time),
    b = await create(pOther, time, "other"),
    c = await create(pSecond, time, "customer", "second-pro");
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: true }, 1)).status,
    200,
  );
  assert.equal(
    (await act("pro", b.id, { type: "respond", accept: true }, 1)).status,
    409,
  );
  assert.equal(
    (await act("second-pro", c.id, { type: "respond", accept: true }, 1))
      .status,
    409,
  );
  const availability = await call(
    "customer",
    `/projects/${p}/professionals/pro/call-slots`,
  );
  assert.equal(availability.status, 200);
  assert.deepEqual(Object.keys(availability.body).sort(), [
    "minutes",
    "slots",
    "timeZone",
  ]);
  assert.ok(!availability.body.slots.includes(time));
  const visit = await project("customer", "second-pro");
  await assert.rejects(
    transaction((c) => assertAppointment(c, "second-pro", time, visit)),
    /overlaps a confirmed call/,
  );
  assert.equal(
    (await act("customer", a.id, { type: "cancel" }, 2)).status,
    200,
  );
  await query(
    "UPDATE projects SET status='booked',scheduled_at=$2 WHERE id=$1",
    [visit, time],
  );
  const blocked = await call("customer", "/call-meetings", {
    id: randomUUID(),
    projectId: p,
    proId: "pro",
    startsAt: time,
    mode: "audio",
  });
  assert.equal(blocked.status, 409);
  await query("UPDATE projects SET status='cancelled' WHERE id=$1", [visit]);
});

test("rescheduling keeps the confirmed reservation until the other user agrees and checks versions", async () => {
  const p = await project(),
    a = await create(p, slot(8));
  await act("pro", a.id, { type: "respond", accept: true }, 1);
  const next = slot(10);
  assert.equal(
    (await act("pro", a.id, { type: "reschedule", startsAt: next }, 2)).status,
    200,
  );
  assert.equal(
    new Date((await row(a.id)).starts_at).toISOString(),
    a.b.startsAt,
  );
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: true }, 3)).status,
    403,
  );
  assert.equal(
    (await act("customer", a.id, { type: "respond", accept: false }, 3)).status,
    200,
  );
  assert.equal((await row(a.id)).status, "confirmed");
  assert.equal(
    new Date((await row(a.id)).starts_at).toISOString(),
    a.b.startsAt,
  );
  assert.equal(
    (await act("customer", a.id, { type: "reschedule", startsAt: next }, 4))
      .status,
    200,
  );
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: true }, 5)).status,
    200,
  );
  assert.equal(new Date((await row(a.id)).starts_at).toISOString(), next);
  assert.equal(
    (await act("customer", a.id, { type: "cancel" }, 6)).status,
    200,
  );
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: true }, 7)).status,
    409,
  );
});

test("closed projects, missing hours, blocked parties, invalid times and suspended businesses cannot schedule", async () => {
  const p = await project();
  const body = {
    id: randomUUID(),
    projectId: p,
    proId: "pro",
    startsAt: slot(14),
    mode: "audio",
  };
  for (const startsAt of [
    new Date().toISOString(),
    new Date(Date.now() + 30 * 86400000).toISOString(),
    new Date(Date.parse(body.startsAt) + 1000).toISOString(),
  ])
    assert.equal(
      (await call("customer", "/call-meetings", { ...body, startsAt })).status,
      409,
    );
  await query("UPDATE profiles SET weekly_hours='{}' WHERE id='pro'");
  assert.equal((await call("customer", "/call-meetings", body)).status, 409);
  await query("UPDATE profiles SET weekly_hours=$1 WHERE id='pro'", [
    JSON.stringify(hours),
  ]);
  await query("INSERT INTO blocked(user_id,other_id) VALUES('pro','customer')");
  assert.equal((await call("customer", "/call-meetings", body)).status, 403);
  await query("DELETE FROM blocked");
  await query("UPDATE profiles SET suspended=true WHERE id='pro'");
  assert.equal((await call("customer", "/call-meetings", body)).status, 403);
  await query("UPDATE profiles SET suspended=false WHERE id='pro'");
  await query("UPDATE projects SET status='cancelled' WHERE id=$1", [p]);
  assert.equal((await call("customer", "/call-meetings", body)).status, 409);
});

test("project closure or another pro selection cancels meetings and alerts both participants", async () => {
  for (const close of ["cancelled", "completed", "reassigned"]) {
    const p = await project(),
      a = await create(p, slot(18));
    await query(
      close !== "reassigned"
        ? `UPDATE projects SET status='${close}' WHERE id=$1`
        : "UPDATE projects SET pro_id='second-pro',status='booked' WHERE id=$1",
      [p],
    );
    assert.equal((await row(a.id)).status, "cancelled");
    assert.equal((await row(a.id)).proposed_at, null);
    const recipients = (
      await query(
        "SELECT user_id FROM notifications WHERE target_id=$1 AND title='Call meeting cancelled' ORDER BY user_id",
        [a.id],
      )
    ).rows.map((r) => r.user_id);
    assert.deepEqual(recipients, ["customer", "pro"]);
    assert.equal(
      (await call("customer", `/call-meetings/${a.id}/join`, {})).status,
      409,
    );
  }
});

test("Daily join is participant-only, time-limited and uses a private scheduled-meeting room", async () => {
  const p = await project(),
    a = await create(p, slot(22));
  await act("pro", a.id, { type: "respond", accept: true }, 1);
  const start = Date.now() - 5 * 60000;
  await query("UPDATE scheduled_calls SET starts_at=$2 WHERE id=$1", [
    a.id,
    new Date(start).toISOString(),
  ]);
  env.DAILY_API_KEY = "test-only-not-a-real-key";
  const original = globalThis.fetch,
    requests: any[] = [];
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input).startsWith("https://api.daily.co/")) {
      requests.push({
        url: String(input),
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      return new Response(
        JSON.stringify(
          String(input).endsWith("meeting-tokens")
            ? { token: "unit-token" }
            : { url: "https://fixture.daily.co/private-room" },
        ),
        { status: 200 },
      );
    }
    return original(input, init);
  }) as typeof fetch;
  try {
    assert.equal(
      (await call("customer", `/call-meetings/${a.id}/join`, {})).status,
      200,
    );
    assert.equal(
      (await call("pro", `/call-meetings/${a.id}/join`, {})).status,
      200,
    );
    const tokens = requests.filter((r) => r.body?.properties?.room_name);
    assert.equal(tokens.length, 2);
    assert.equal(
      tokens[0].body.properties.room_name,
      tokens[1].body.properties.room_name,
    );
    assert.deepEqual(
      tokens.map((r) => r.body.properties.user_id),
      ["customer", "pro"],
    );
    assert.equal(tokens[0].body.properties.is_owner, false);
    assert.equal(
      tokens[0].body.properties.exp,
      Math.floor((start + 30 * 60000) / 1000),
    );
    assert.equal(tokens[0].body.properties.eject_at_token_exp, true);
  } finally {
    globalThis.fetch = original;
  }
  await query("UPDATE scheduled_calls SET starts_at=$2 WHERE id=$1", [
    a.id,
    new Date(start - 2 * 3600000).toISOString(),
  ]);
  assert.equal(
    (await call("customer", `/call-meetings/${a.id}/join`, {})).status,
    409,
  );
  assert.equal((await act("pro", a.id, { type: "complete" }, 2)).status, 200);
});

test("join window boundaries require a confirmed meeting", () => {
  const start = Date.parse("2030-01-01T12:00:00Z"),
    m = {
      status: "confirmed" as const,
      startsAt: new Date(start).toISOString(),
    };
  assert.equal(callCanJoin(m, start - 15 * 60000), true);
  assert.equal(callCanJoin(m, start - 15 * 60000 - 1), false);
  assert.equal(callCanJoin(m, start + 30 * 60000 - 1), true);
  assert.equal(callCanJoin(m, start + 30 * 60000), false);
  assert.equal(
    callIsActive({ ...m, proposedAt: null }, start + 30 * 60000),
    false,
  );
  assert.equal(
    callIsActive({ ...m, status: "requested", proposedAt: m.startsAt }, start),
    false,
  );
  assert.equal(callCanJoin({ ...m, status: "requested" }, start), false);
});

test("new requests require current matching eligibility and an initial decline closes a request", async () => {
  const p = await project(),
    time = slot(28);
  const body = {
    id: randomUUID(),
    projectId: p,
    proId: "pro",
    startsAt: time,
    mode: "audio",
  };
  await query("UPDATE profiles SET verified=false WHERE id='pro'");
  assert.equal((await call("customer", "/call-meetings", body)).status, 403);
  await query("UPDATE profiles SET verified=true WHERE id='pro'");
  await query(
    "UPDATE professional_subscriptions SET status='cancelled' WHERE user_id='pro'",
  );
  assert.equal((await call("customer", "/call-meetings", body)).status, 403);
  await query(
    "UPDATE professional_subscriptions SET status='active' WHERE user_id='pro'",
  );
  await query("UPDATE profiles SET zip='99999' WHERE id='pro'");
  assert.equal((await call("customer", "/call-meetings", body)).status, 403);
  await query("UPDATE profiles SET zip='10001' WHERE id='pro'");
  const a = await create(p, time);
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: false }, 1)).status,
    200,
  );
  assert.equal((await row(a.id)).status, "declined");
  assert.equal((await row(a.id)).proposed_at, null);
  assert.equal(
    (await act("customer", a.id, { type: "reschedule", startsAt: slot(30) }, 2))
      .status,
    409,
  );
});

test("a competing confirmation makes a proposed new time unavailable without losing the original reservation", async () => {
  const p = await project(),
    other = await project("other"),
    a = await create(p, slot(32));
  await act("pro", a.id, { type: "respond", accept: true }, 1);
  await act("customer", a.id, { type: "reschedule", startsAt: slot(34) }, 2);
  const b = await create(other, slot(34), "other");
  assert.equal(
    (await act("pro", b.id, { type: "respond", accept: true }, 1)).status,
    200,
  );
  assert.equal(
    (await act("pro", a.id, { type: "respond", accept: true }, 3)).status,
    409,
  );
  assert.equal(
    new Date((await row(a.id)).starts_at).toISOString(),
    a.b.startsAt,
  );
  assert.equal((await row(a.id)).status, "confirmed");
  await act("pro", a.id, { type: "respond", accept: false }, 3);
});

test("only one active meeting per pair across projects, times and initiators; closure permits the next", async () => {
  const p = await project(),
    p2 = await project(),
    a = await create(p);
  const body = {
    id: randomUUID(),
    projectId: p2,
    proId: "pro",
    startsAt: slot(2),
    mode: "audio",
  };
  for (const user of ["customer", "pro"]) {
    const r = await call(user, "/call-meetings", body);
    assert.equal(r.status, 409);
    assert.match(r.body.error, /already have an active meeting/);
  }
  await assert.rejects(
    query(
      "INSERT INTO scheduled_calls(id,project_id,customer_id,pro_id,starts_at,mode) VALUES($1,$2,'customer','pro',$3,'video')",
      [randomUUID(), p2, slot(2)],
    ),
    /scheduled_calls_one_active_pair/,
  );
  await act("pro", a.id, { type: "cancel" }, 1);
  const b = await create(p2, slot(2), "pro");
  await act("customer", b.id, { type: "respond", accept: false }, 1);
  const c = await create(p);
  await act("pro", c.id, { type: "respond", accept: true }, 1);
  assert.equal(
    (await call("customer", "/call-meetings", { ...body, id: randomUUID() }))
      .status,
    409,
  );
});

test("elapsed confirmed meetings close automatically, notify both once and free the pair", async () => {
  const p = await project(),
    a = await create(p);
  await act("pro", a.id, { type: "respond", accept: true }, 1);
  await query(
    "UPDATE scheduled_calls SET starts_at=now()-interval '31 minutes' WHERE id=$1",
    [a.id],
  );
  assert.equal(
    (await call("pro", `/call-meetings/${a.id}/join`, {})).status,
    409,
  );
  await call("customer", "/call-meetings");
  assert.equal((await row(a.id)).status, "completed");
  await call("pro", "/call-meetings");
  const notices = (
    await query(
      "SELECT user_id FROM notifications WHERE target_id=$1 AND title='Call meeting completed' ORDER BY user_id",
      [a.id],
    )
  ).rows;
  assert.deepEqual(
    notices.map((n) => n.user_id),
    ["customer", "pro"],
  );
  await create(p, slot(2));
});

test("unconfirmed requests expire using the latest proposed time and creation also clears old meetings", async () => {
  const p = await project(),
    a = await create(p);
  await query(
    "UPDATE scheduled_calls SET starts_at=now()-interval '1 hour' WHERE id=$1",
    [a.id],
  );
  await call("customer", "/call-meetings");
  assert.equal(
    (await row(a.id)).status,
    "requested",
    "a future proposed time still awaits a response",
  );
  await query(
    "UPDATE scheduled_calls SET proposed_at=now()-interval '1 minute' WHERE id=$1",
    [a.id],
  );
  await create(p, slot(2));
  assert.equal((await row(a.id)).status, "cancelled");
  const notices = (
    await query(
      "SELECT user_id FROM notifications WHERE target_id=$1 AND title='Call request expired' ORDER BY user_id",
      [a.id],
    )
  ).rows;
  assert.deepEqual(
    notices.map((n) => n.user_id),
    ["customer", "pro"],
  );
});

test("migration retains one confirmed meeting and safely closes historical duplicates", async () => {
  const old = new PGlite();
  try {
    for (const file of (await readdir("src/server/db/migrations"))
      .filter((f) => f.endsWith(".sql") && f < "014")
      .sort())
      await old.exec(
        await readFile("src/server/db/migrations/" + file, "utf8"),
      );
    await old.exec(
      "INSERT INTO users(id,email,name,role) VALUES('c','c@fixture.invalid','C','customer'),('p','p@fixture.invalid','P','pro'); INSERT INTO profiles(id,business,category,bio,zip,rate) VALUES('p','Business','Cleaning','Business details','10001',40)",
    );
    const p = randomUUID(),
      ids = [randomUUID(), randomUUID(), randomUUID()];
    await old.query(
      "INSERT INTO projects(id,customer_id,title,description,category,zip) VALUES($1,'c','Test project','Details for migration','Cleaning','10001')",
      [p],
    );
    for (let i = 0; i < ids.length; i++)
      await old.query(
        "INSERT INTO scheduled_calls(id,project_id,customer_id,pro_id,starts_at,mode,status) VALUES($1,$2,'c','p',$3,'video',$4)",
        [ids[i], p, slot(i), i === 1 ? "confirmed" : "requested"],
      );
    await old.exec(
      await readFile(
        "src/server/db/migrations/014_one_active_call_per_pair.sql",
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await old.query<any>(
          "SELECT id FROM scheduled_calls WHERE status='confirmed'",
        )
      ).rows.map((r) => r.id),
      [ids[1]],
    );
    assert.equal(
      (
        await old.query(
          "SELECT id FROM scheduled_calls WHERE status='cancelled'",
        )
      ).rows.length,
      2,
    );
    assert.equal(
      (
        await old.query(
          "SELECT id FROM notifications WHERE title='Duplicate call request closed'",
        )
      ).rows.length,
      4,
    );
  } finally {
    await old.close();
  }
});

test("a cancellation while Daily creates a token does not release a join link", async () => {
  const p = await project(),
    a = await create(p);
  await act("pro", a.id, { type: "respond", accept: true }, 1);
  await query(
    "UPDATE scheduled_calls SET starts_at=now()-interval '5 minutes' WHERE id=$1",
    [a.id],
  );
  env.DAILY_API_KEY = "test-only-not-a-real-key";
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any) => {
    if (!String(input).startsWith("https://api.daily.co/"))
      return original(input, init);
    if (String(input).endsWith("meeting-tokens")) {
      await query(
        "UPDATE scheduled_calls SET status='cancelled',version=version+1 WHERE id=$1",
        [a.id],
      );
      return Response.json({ token: "must-not-be-returned" });
    }
    return Response.json({ url: "https://fixture.daily.co/private-room" });
  }) as typeof fetch;
  try {
    const r = await call("customer", `/call-meetings/${a.id}/join`, {});
    assert.equal(r.status, 409);
    assert.equal(r.body.url, undefined);
    assert.equal(
      (await query("SELECT id FROM call_events WHERE project_id=$1", [p])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await query(
          "SELECT id FROM notifications WHERE target_id=$1 AND title='Your call partner is joining'",
          [a.id],
        )
      ).rows.length,
      0,
    );
  } finally {
    globalThis.fetch = original;
  }
});
