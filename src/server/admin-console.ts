import { Router } from "express";
import { z } from "zod";
import { pool, camel, transaction } from "./db/index.js";
import { audit, profileSelect } from "./repository.js";
import {
  downloadUrl,
  imageUrl,
  projectImageUrl,
} from "./integrations/storage.js";
import { fail } from "./errors.js";
import type { Profile } from "../shared/domain.js";
import { stripe } from "./integrations/stripe.js";
import { subscriptionMembership } from "./membership-plans.js";
export const adminConsole = Router();
adminConsole.use((req, res, next) => {
  if (req.account.role !== "admin") fail(403, "Administrator access required.");
  res.setHeader("Cache-Control", "no-store");
  next();
});
const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    q: z.string().trim().max(100).default(""),
    status: z.string().max(32).default(""),
    userId: z.string().max(128).default(""),
  })
  .strict();
const rows = async (sql: string, params: unknown[] = []) =>
  (await pool.query(sql, params)).rows.map((r) => camel(r));
async function logRead(actor: string, action: string, entity: string) {
  await transaction((c) => audit(c, actor, action, entity));
}
adminConsole.get("/session", async (req, res) => {
  const notices = await rows(
    "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
    [req.account.id],
  );
  const unreadCount = (
    await pool.query(
      "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND NOT read",
      [req.account.id],
    )
  ).rows[0].n;
  res.json({ user: req.account, notices, unreadCount });
});
adminConsole.get("/overview", async (_req, res) => {
  const totals = (
    await pool.query(`SELECT
   (SELECT count(*)::int FROM users WHERE role<>'admin') AS users,
   (SELECT count(*)::int FROM users WHERE role='customer') AS customers,
   (SELECT count(*)::int FROM users WHERE role='pro') AS professionals,
   (SELECT count(*)::int FROM profiles WHERE review_status='pending') AS pending_reviews,
   (SELECT count(*)::int FROM profiles WHERE verified) AS verified,
   (SELECT count(*)::int FROM profiles WHERE listed AND NOT suspended) AS listed,
   (SELECT count(*)::int FROM professional_subscriptions WHERE status IN ('active','trialing')) AS memberships,
   (SELECT count(*)::int FROM projects) AS projects,
   (SELECT count(*)::int FROM projects WHERE status='completed') AS completed,
   (SELECT count(*)::int FROM projects WHERE status='disputed') AS disputed,
   (SELECT count(*)::int FROM discussion_messages)+(SELECT count(*)::int FROM messages m WHERE NOT EXISTS(SELECT 1 FROM discussion_messages d WHERE d.id=m.id)) AS messages,
   (SELECT count(*)::int FROM project_discussions) AS conversations,
   (SELECT count(*)::int FROM quotes) AS estimates,
   (SELECT count(*)::int FROM tickets WHERE status='open') AS open_support,
   (SELECT count(*)::int FROM call_events) AS call_invitations,
   (SELECT count(*)::int FROM uploads WHERE status='ready') AS files`)
  ).rows[0];
  const trend = (
    await pool.query(`WITH days AS (SELECT generate_series(date_trunc('day',now() AT TIME ZONE 'UTC')-interval '29 days',date_trunc('day',now() AT TIME ZONE 'UTC'),interval '1 day') AS day)
   SELECT to_char(day,'YYYY-MM-DD') AS day,
   (SELECT count(*)::int FROM users WHERE role<>'admin' AND created_at>=(day AT TIME ZONE 'UTC') AND created_at<((day+interval '1 day') AT TIME ZONE 'UTC')) AS users,
   (SELECT count(*)::int FROM projects WHERE created_at>=(day AT TIME ZONE 'UTC') AND created_at<((day+interval '1 day') AT TIME ZONE 'UTC')) AS projects,
   (SELECT count(*)::int FROM discussion_messages WHERE created_at>=(day AT TIME ZONE 'UTC') AND created_at<((day+interval '1 day') AT TIME ZONE 'UTC')) AS messages FROM days ORDER BY day`)
  ).rows;
  const statuses = await rows(
    "SELECT status AS label,count(*)::int AS count FROM projects GROUP BY status ORDER BY count DESC",
  );
  const categories = await rows(
    "SELECT category AS label,count(*)::int AS count FROM projects GROUP BY category ORDER BY count DESC,category",
  );
  const engagement = await rows(`SELECT u.id,u.name,u.role,
   (SELECT count(*)::int FROM projects p WHERE p.customer_id=u.id OR p.pro_id=u.id) AS projects,
   (SELECT count(*)::int FROM discussion_messages m WHERE m.sender_id=u.id) AS messages,
   (SELECT count(*)::int FROM quotes q WHERE q.pro_id=u.id) AS estimates,
   (SELECT count(*)::int FROM projects p WHERE (p.customer_id=u.id OR p.pro_id=u.id) AND p.status='completed') AS completed
   FROM users u WHERE role<>'admin' ORDER BY messages DESC,projects DESC,u.id LIMIT 10`);
  const recent = await rows(
    "SELECT a.id,a.action,a.entity_id,a.created_at,u.name AS actor FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.id DESC LIMIT 15",
  );
  res.json({
    totals: camel(totals),
    trend,
    statuses,
    categories,
    engagement,
    recent,
    generatedAt: new Date().toISOString(),
  });
});
adminConsole.get("/notifications", async (req, res) => {
  const { page } = pageSchema.parse(req.query);
  const total = (
    await pool.query(
      "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0].n;
  const result = await rows(
    "SELECT id,title,body,read,target_page,target_id,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $2",
    [req.account.id, (page - 1) * 25],
  );
  res.json({ rows: result, total, page, pageSize: 25 });
});
const collections = {
  users: {
    from: "users u",
    select:
      "u.id,u.name,u.email,u.role,u.created_at,(SELECT count(*)::int FROM projects p WHERE p.customer_id=u.id OR p.pro_id=u.id) AS projects",
    search: "u.name||' '||u.email||' '||u.id",
    status: "u.role",
    order: "u.created_at DESC,u.id",
  },
  professionals: {
    from: "profiles p JOIN users u ON u.id=p.id LEFT JOIN professional_subscriptions s ON s.user_id=p.id",
    select:
      "p.id,p.business,u.name,u.email,p.category,p.review_status,p.verified,p.listed,p.suspended,p.available,COALESCE(s.status,'none') AS membership",
    search: "p.business||' '||u.name||' '||u.email",
    status: "p.review_status",
    order: "p.submitted_at DESC NULLS LAST,p.id",
  },
  projects: {
    from: "projects p JOIN users u ON u.id=p.customer_id LEFT JOIN users pro ON pro.id=p.pro_id",
    select:
      "p.id,p.title,p.category,p.status,p.created_at,u.name AS customer_name,pro.name AS pro_name",
    search: "p.title||' '||u.name||' '||COALESCE(pro.name,'')||' '||p.id::text",
    status: "p.status",
    order: "p.created_at DESC,p.id",
  },
  memberships: {
    from: "users u LEFT JOIN professional_subscriptions s ON s.user_id=u.id LEFT JOIN profiles p ON p.id=u.id",
    select:
      "u.id,u.name,u.email,p.business,COALESCE(s.status,'none') AS status,s.cancel_at_period_end,s.updated_at",
    search: "u.name||' '||u.email||' '||COALESCE(p.business,'')",
    status: "COALESCE(s.status,'none')",
    order: "s.updated_at DESC NULLS LAST,u.id",
    base: "u.role='pro'",
  },
  identity: {
    from: "profiles p JOIN users u ON u.id=p.id",
    select:
      "p.id,p.business,u.name,u.email,p.verified,p.review_status,p.identity_session_id",
    search: "p.business||' '||u.email",
    status:
      "CASE WHEN p.verified THEN 'verified' WHEN p.identity_session_id IS NOT NULL THEN 'pending' ELSE 'not_started' END",
    order: "u.created_at DESC,p.id",
  },
  audit: {
    from: "audit_log a LEFT JOIN users u ON u.id=a.actor_id",
    select: "a.id,u.name AS actor,a.action,a.entity_id,a.created_at",
    search: "a.action||' '||a.entity_id||' '||COALESCE(u.name,'')",
    status: "a.action",
    order: "a.created_at DESC,a.id",
  },
} as const;
// Each source contributes actual stored activity, without repeating messages
// copied from the legacy project chat during the discussion migration.
const interactionEdges = `WITH events AS (
 SELECT p.customer_id,d.pro_id,p.id AS project_id,d.created_at AS at,'conversation' AS kind
 FROM project_discussions d JOIN projects p ON p.id=d.project_id
 UNION ALL SELECT p.customer_id,d.pro_id,p.id,m.created_at,'message'
 FROM discussion_messages m JOIN project_discussions d ON d.id=m.discussion_id JOIN projects p ON p.id=d.project_id
 UNION ALL SELECT p.customer_id,q.pro_id,p.id,q.created_at,'estimate'
 FROM quotes q JOIN projects p ON p.id=q.project_id
 UNION ALL SELECT customer_id,pro_id,id,created_at,'assignment' FROM projects WHERE pro_id IS NOT NULL
 UNION ALL SELECT p.customer_id,p.pro_id,p.id,m.created_at,'message'
 FROM messages m JOIN projects p ON p.id=m.project_id WHERE p.pro_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM discussion_messages dm WHERE dm.id=m.id)
 UNION ALL SELECT p.customer_id,COALESCE(d.pro_id,p.pro_id),p.id,e.created_at,'call'
 FROM call_events e JOIN projects p ON p.id=e.project_id LEFT JOIN project_discussions d ON d.id=e.discussion_id
 WHERE COALESCE(d.pro_id,p.pro_id) IS NOT NULL
), edges AS (
 SELECT customer_id,pro_id,count(DISTINCT project_id)::int AS projects,
 count(*) FILTER(WHERE kind='conversation')::int AS conversations,
 count(*) FILTER(WHERE kind='message')::int AS messages,
 count(*) FILTER(WHERE kind='estimate')::int AS estimates,
 count(*) FILTER(WHERE kind='call')::int AS call_invitations,max(at) AS last_interaction_at
 FROM events GROUP BY customer_id,pro_id
)`;
adminConsole.get("/interactions", async (req, res) => {
  const { page, q, userId } = pageSchema.parse(req.query);
  const params: unknown[] = [],
    conditions: string[] = [];
  if (userId) {
    params.push(userId);
    conditions.push(
      `(e.customer_id=$${params.length} OR e.pro_id=$${params.length})`,
    );
  }
  if (q) {
    params.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%");
    conditions.push(
      `(c.name||' '||pro.name||' '||COALESCE(p.business,'')) ILIKE $${params.length}`,
    );
  }
  const from =
    " FROM edges e JOIN users c ON c.id=e.customer_id JOIN users pro ON pro.id=e.pro_id LEFT JOIN profiles p ON p.id=e.pro_id";
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const total = (
    await pool.query(
      interactionEdges + " SELECT count(*)::int AS n" + from + where,
      params,
    )
  ).rows[0].n;
  const result = await rows(
    interactionEdges +
      ` SELECT e.*,c.name AS customer,COALESCE(p.business,pro.name) AS professional${from}${where} ORDER BY last_interaction_at DESC,e.customer_id,e.pro_id LIMIT 25 OFFSET $${params.length + 1}`,
    [...params, (page - 1) * 25],
  );
  await logRead(
    req.account.id,
    "admin_interactions_read",
    userId || "marketplace",
  );
  res.json({ rows: result, total, page, pageSize: 25 });
});
for (const [key, definition] of Object.entries(collections))
  adminConsole.get("/" + key, async (req, res) => {
    const { page, q, status, userId } = pageSchema.parse(req.query);
    const conditions: string[] = [],
      params: unknown[] = [];
    if ("base" in definition) conditions.push(definition.base);
    if (q) {
      params.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%");
      conditions.push(`(${definition.search}) ILIKE $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`${definition.status}=$${params.length}`);
    }
    if (userId && key === "projects") {
      params.push(userId);
      conditions.push(
        `(p.customer_id=$${params.length} OR p.pro_id=$${params.length} OR EXISTS(SELECT 1 FROM quotes qu WHERE qu.project_id=p.id AND qu.pro_id=$${params.length}) OR EXISTS(SELECT 1 FROM project_discussions d WHERE d.project_id=p.id AND d.pro_id=$${params.length}))`,
      );
    }
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const total = (
      await pool.query(
        "SELECT count(*)::int AS n FROM " + definition.from + where,
        params,
      )
    ).rows[0].n;
    const result = await rows(
      `SELECT ${definition.select} FROM ${definition.from}${where} ORDER BY ${definition.order} LIMIT 25 OFFSET $${params.length + 1}`,
      [...params, (page - 1) * 25],
    );
    res.json({ rows: result, total, page, pageSize: 25 });
  });
adminConsole.get("/users/:id", async (req, res) => {
  const id = z.string().min(1).max(128).parse(req.params.id);
  const user = (
    await rows(
      "SELECT id,name,email,role,settings,created_at FROM users WHERE id=$1",
      [id],
    )
  )[0];
  if (!user) fail(404, "User not found.");
  const profileRow = (await pool.query(profileSelect + " WHERE p.id=$1", [id]))
    .rows[0];
  let profile: Profile | null = null;
  if (profileRow) {
    profile = camel<Profile>(profileRow);
    profile.images = (await Promise.all(
      (profileRow.images || []).map(
        async (i: { id: string; slot: string; key: string }) => ({
          id: i.id,
          slot: i.slot,
          url: await imageUrl(i.key).catch(() => ""),
        }),
      ),
    )) as Profile["images"];
  }
  const membership =
    (
      await rows(
        "SELECT status,customer_id,subscription_id,cancel_at_period_end,updated_at FROM professional_subscriptions WHERE user_id=$1",
        [id],
      )
    )[0] || null;
  const metrics = (
    await pool.query(
      `SELECT
    (SELECT count(*)::int FROM projects WHERE customer_id=$1 OR pro_id=$1) AS projects,
    (SELECT count(*)::int FROM projects WHERE (customer_id=$1 OR pro_id=$1) AND status='completed') AS completed,
    (SELECT count(*)::int FROM discussion_messages WHERE sender_id=$1) AS messages,
    (SELECT count(*)::int FROM quotes WHERE pro_id=$1) AS estimates,
    (SELECT count(*)::int FROM call_events WHERE actor_id=$1) AS call_invitations,
    (SELECT count(*)::int FROM tickets WHERE user_id=$1) AS support_cases,
    (SELECT count(*)::int FROM saved WHERE pro_id=$1) AS saved_by_customers,
    (SELECT count(*)::int FROM reviews WHERE pro_id=$1) AS reviews`,
      [id],
    )
  ).rows[0];
  const projects = await rows(
    "SELECT id,title,status,category,created_at FROM projects WHERE customer_id=$1 OR pro_id=$1 OR id IN (SELECT project_id FROM quotes WHERE pro_id=$1) ORDER BY created_at DESC LIMIT 10",
    [id],
  );
  const tickets = await rows(
    "SELECT * FROM tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10",
    [id],
  );
  await logRead(req.account.id, "admin_user_read", id);
  res.json({
    user,
    profile,
    membership,
    metrics: camel(metrics),
    projects,
    tickets,
  });
});
adminConsole.get("/projects/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const project = (
    await rows(
      "SELECT p.*,u.name AS customer_name,pro.name AS pro_name FROM projects p JOIN users u ON u.id=p.customer_id LEFT JOIN users pro ON pro.id=p.pro_id WHERE p.id=$1",
      [id],
    )
  )[0];
  if (!project) fail(404, "Project not found.");
  await logRead(req.account.id, "admin_project_read", id);
  res.json({ project });
});
adminConsole.get("/users/:id/identity", async (req, res) => {
  const id = z.string().min(1).max(128).parse(req.params.id);
  const profile = (
    await pool.query(
      "SELECT verified,identity_session_id FROM profiles WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!profile) fail(404, "Business profile not found.");
  await logRead(req.account.id, "admin_identity_read", id);
  if (!profile.identity_session_id)
    return res.json({
      verified: profile.verified,
      status: profile.verified ? "verified" : "not_started",
      sessionId: null,
    });
  try {
    const session = await stripe().identity.verificationSessions.retrieve(
      profile.identity_session_id,
    );
    res.json({
      verified: profile.verified,
      status: session.status,
      sessionId: session.id,
      liveMode: session.livemode,
      lastErrorCode: session.last_error?.code || null,
      createdAt: new Date(session.created * 1000).toISOString(),
    });
  } catch {
    fail(
      503,
      "Stripe verification details are temporarily unavailable. Stored identity status is still shown.",
    );
  }
});
adminConsole.get("/users/:id/billing", async (req, res) => {
  const id = z.string().min(1).max(128).parse(req.params.id);
  const row = (
    await pool.query(
      "SELECT subscription_id,customer_id,status FROM professional_subscriptions WHERE user_id=$1",
      [id],
    )
  ).rows[0];
  await logRead(req.account.id, "admin_membership_read", id);
  if (!row?.subscription_id)
    return res.json({ status: row?.status || "none", plan: null });
  try {
    const sub = await stripe().subscriptions.retrieve(row.subscription_id);
    const customer =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (customer !== row.customer_id)
      fail(503, "Subscription ownership could not be confirmed.");
    const item = sub.items.data[0];
    res.json({
      status: sub.status,
      plan: subscriptionMembership(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currency: item?.price.currency,
      recurringAmountCents: item?.price.unit_amount,
      interval: item?.price.recurring?.interval,
      intervalCount: item?.price.recurring?.interval_count,
      periodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      liveMode: sub.livemode,
    });
  } catch {
    fail(
      503,
      "Stripe billing details are temporarily unavailable. Stored membership status is still shown.",
    );
  }
});
const projectRecords = {
  estimates: {
    from: "quotes t JOIN users u ON u.id=t.pro_id",
    select:
      "t.id,u.name AS professional,t.amount,t.labor_amount,t.materials_amount,t.description,t.exclusions,t.timeline,t.expires_at,t.status,t.revision,t.created_at",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  activity: {
    from: "project_activity t JOIN users u ON u.id=t.actor_id",
    select: "t.id,u.name AS actor,t.action,t.summary,t.reason,t.created_at",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  conversations: {
    from: "project_discussions t JOIN users u ON u.id=t.pro_id",
    select:
      "t.id,u.name AS professional,t.created_at,(SELECT count(*)::int FROM discussion_messages m WHERE m.discussion_id=t.id) AS messages",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  files: {
    from: "uploads t JOIN users u ON u.id=t.user_id",
    select:
      "t.id,t.name,t.content_type,t.size,t.status,u.name AS uploaded_by,t.created_at",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  reviews: {
    from: "reviews t",
    select: "t.id,t.rating,t.body,t.reply,t.created_at",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  calls: {
    from: "call_events t JOIN users u ON u.id=t.actor_id",
    select: "t.id,u.name AS actor,t.mode,t.discussion_id,t.created_at",
    where: "t.project_id=$1",
    order: "t.created_at DESC,t.id",
  },
  legacy: {
    from: "messages t JOIN users u ON u.id=t.sender_id",
    select: "t.id,u.name AS sender,t.body,t.created_at",
    where:
      "t.project_id=$1 AND NOT EXISTS(SELECT 1 FROM discussion_messages m WHERE m.id=t.id)",
    order: "t.created_at DESC,t.id",
  },
} as const;
adminConsole.get("/projects/:id/records/:kind", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    kind = z
      .enum([
        "estimates",
        "activity",
        "conversations",
        "files",
        "reviews",
        "calls",
        "legacy",
      ])
      .parse(req.params.kind);
  const { page } = pageSchema.parse(req.query),
    d = projectRecords[kind];
  if (!(await pool.query("SELECT id FROM projects WHERE id=$1", [id])).rowCount)
    fail(404, "Project not found.");
  const total = (
    await pool.query(
      `SELECT count(*)::int AS n FROM ${d.from} WHERE ${d.where}`,
      [id],
    )
  ).rows[0].n;
  const result = await rows(
    `SELECT ${d.select} FROM ${d.from} WHERE ${d.where} ORDER BY ${d.order} LIMIT 25 OFFSET $2`,
    [id, (page - 1) * 25],
  );
  await logRead(req.account.id, "admin_project_" + kind + "_read", id);
  res.json({ rows: result, total, page, pageSize: 25 });
});
adminConsole.get("/conversations/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    { page } = pageSchema.parse(req.query);
  const discussion = (
    await rows(
      "SELECT d.id,d.project_id,u.name AS professional,p.title,c.name AS customer FROM project_discussions d JOIN projects p ON p.id=d.project_id JOIN users u ON u.id=d.pro_id JOIN users c ON c.id=p.customer_id WHERE d.id=$1",
      [id],
    )
  )[0];
  if (!discussion) fail(404, "Conversation not found.");
  const total = (
    await pool.query(
      "SELECT count(*)::int AS n FROM discussion_messages WHERE discussion_id=$1",
      [id],
    )
  ).rows[0].n;
  const messages = await rows(
    "SELECT m.id,m.body,u.name AS sender,u.role,m.created_at FROM discussion_messages m JOIN users u ON u.id=m.sender_id WHERE m.discussion_id=$1 ORDER BY m.created_at DESC,m.id DESC LIMIT 25 OFFSET $2",
    [id, (page - 1) * 25],
  );
  await logRead(req.account.id, "admin_conversation_read", id);
  res.json({ discussion, rows: messages.reverse(), total, page, pageSize: 25 });
});
adminConsole.get("/files/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const file = (
    await pool.query(
      "SELECT object_key,name,content_type FROM uploads WHERE id=$1 AND status='ready'",
      [id],
    )
  ).rows[0];
  if (!file) fail(404, "Ready file not found.");
  await logRead(req.account.id, "admin_file_access", id);
  res.json({
    url: await downloadUrl(file.object_key),
    name: file.name,
    previewUrl: ["image/jpeg", "image/png", "image/webp"].includes(
      file.content_type,
    )
      ? await projectImageUrl(file.object_key, file.content_type)
      : null,
  });
});
