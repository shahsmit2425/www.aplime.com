import { discussions } from "./discussions.js";
import { reserveUpload } from "./uploads.js";
import { uploadSchema } from "../shared/uploads.js";
import { subscriptions } from "./subscriptions.js";
import { Router, json, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  signupSchema,
  profileSchema,
  projectSchema,
  actionSchema,
  isMember,
  assertFuture,
  type User,
  type Project,
} from "../shared/domain.js";
import { pool, camel, transaction } from "./db/index.js";
import { assertAdmin } from "./admin-policy.js";
import { verifyToken } from "./integrations/firebase.js";
import { env, publicConfig } from "./config.js";
import { fail } from "./errors.js";
import {
  publicProfiles,
  workspace,
  getProject,
  notify,
  audit,
} from "./repository.js";
import { projectAction } from "./projects.js";
import { stripe } from "./integrations/stripe.js";
import { meeting } from "./integrations/daily.js";
import {
  uploadUrl,
  downloadUrl,
  inspectObject,
  removeObject,
} from "./integrations/storage.js";
import { locate } from "./integrations/maps.js";
import { distributedLimiter } from "./integrations/redis.js";
declare global {
  namespace Express {
    interface Request {
      account: User;
      identity: { uid: string; email: string; admin?: boolean };
    }
  }
}
type AuthRequest = Request;
export const api = Router();
api.get("/config", (_q, r) => r.json(publicConfig));
api.get("/professionals/:id", async (q, r) =>
  r.json(await publicProfiles(String(q.params.id))),
);
api.get("/professionals", async (_q, r) => r.json(await publicProfiles()));
api.get("/health", async (_q, r) => {
  if (!env.DATABASE_URL)
    return r
      .status(503)
      .json({ ok: false, reason: "Database configuration required" });
  await pool.query("SELECT 1");
  r.json({
    ok: true,
    environment: env.APP_ENV,
    release: env.RENDER_GIT_COMMIT,
  });
});
api.use(json({ limit: "64kb" }));
api.use(async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) fail(401, "Sign in to continue.");
  const decoded = await verifyToken(token);
  const q = req as AuthRequest;
  q.identity = {
    uid: decoded.uid,
    email: decoded.email!,
    admin: decoded.admin === true,
  };
  if (distributedLimiter) {
    const result = await distributedLimiter.limit(decoded.uid);
    if (!result.success)
      return res.status(429).json({ error: "Please slow down and try again." });
  }
  const record = (
    await pool.query("SELECT * FROM users WHERE id=$1", [decoded.uid])
  ).rows[0];
  if (record) {
    q.account = camel<User>(record);
  }
  if (
    /^\/admin(?:\/|$)/i.test(req.path) ||
    q.account?.role === "admin" ||
    q.identity.admin
  ) {
    assertAdmin(
      decoded,
      q.account,
      env.ADMIN_ALLOWED_UIDS.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    );
    if (!/^\/admin(?:\/|$)/i.test(req.path))
      fail(403, "Use the separate administrator application.");
  }
  next();
});
api.post("/account", async (req, res) => {
  const q = req as AuthRequest;
  const data = signupSchema.parse(q.body);
  if (q.account) return res.json(q.account);
  await pool.query(
    "INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
    [q.identity.uid, q.identity.email, data.name, data.role],
  );
  res.status(201).json({ ok: true });
});
api.use((req, _res, next) => {
  if (!(req as AuthRequest).account) fail(428, "Complete your account setup.");
  next();
});
api.use("/subscription", subscriptions);
api.get("/workspace", async (q, r) =>
  r.json(await workspace((q as AuthRequest).account)),
);
api.put("/account", async (req, res) => {
  const q = req as AuthRequest;
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      emailAlerts: z.boolean(),
    })
    .strict()
    .parse(q.body);
  await pool.query(
    "UPDATE users SET name=$2,settings=jsonb_set(settings,'{emailAlerts}',$3::jsonb) WHERE id=$1",
    [q.account.id, data.name, JSON.stringify(data.emailAlerts)],
  );
  res.json({ ok: true });
});
api.put("/profile", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "pro") fail(403, "Professional account required.");
  const p = profileSchema.parse(q.body);
  await pool.query(
    "INSERT INTO profiles(id,business,category,bio,zip,rate,available,availability,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET business=$2,category=$3,bio=$4,zip=$5,rate=$6,available=$7,availability=$8,details=$9",
    [
      q.account.id,
      p.business,
      p.category,
      p.bio,
      p.zip,
      p.rate,
      p.available,
      JSON.stringify(p.availability),
      JSON.stringify(p.details),
    ],
  );
  res.json({ ok: true });
});
api.use(discussions);
api.post("/projects", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "customer") fail(403, "Customer account required.");
  const p = projectSchema.parse(q.body);
  assertFuture(p.scheduledAt);
  const id = randomUUID();
  await transaction(async (c) => {
    if (
      p.proId &&
      !(
        await c.query(
          "SELECT 1 FROM profiles WHERE id=$1 AND category=$2 AND verified AND NOT suspended AND available AND EXISTS (SELECT 1 FROM professional_subscriptions s WHERE s.user_id=profiles.id AND s.status IN ('active','trialing'))",
          [p.proId, p.category],
        )
      ).rowCount
    )
      fail(400, "Choose an available professional in this category.");
    await c.query(
      "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,scheduled_at,intake) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        q.account.id,
        p.proId,
        p.title,
        p.description,
        p.category,
        p.zip,
        null,
        JSON.stringify(p.intake),
      ],
    );
    if (p.proId)
      await c.query(
        "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3)",
        [randomUUID(), id, p.proId],
      );
    if (p.scheduledAt)
      await c.query(
        "UPDATE projects SET proposed_at=$2,proposed_by=$3 WHERE id=$1",
        [id, p.scheduledAt, q.account.id],
      );
    await notify(
      c,
      p.proId,
      "New project request",
      "A customer sent you a project request.",
    );
  });
  res.status(201).json({ id });
});
api.post("/projects/:id/actions", async (req, res) =>
  res.json(
    await projectAction(
      z.string().uuid().parse(req.params.id),
      (req as AuthRequest).account,
      actionSchema.parse(req.body),
    ),
  ),
);
async function memberProject(id: string, user: User) {
  const p = (
    await pool.query("SELECT * FROM projects WHERE id=$1", [
      z.string().uuid().parse(id),
    ])
  ).rows[0];
  if (!p || !isMember(camel<Project>(p), user))
    fail(403, "This project is private.");
  return camel<Project>(p);
}
api.post("/projects/:id/messages", async (req, res) => {
  const q = req as AuthRequest;
  const body = z
    .object({ body: z.string().trim().min(1).max(4000) })
    .strict()
    .parse(q.body);
  const p = await memberProject(String(q.params.id), q.account);
  if (!p.proId)
    fail(409, "Choose an estimate before messaging a professional.");
  const other = q.account.id === p.customerId ? p.proId : p.customerId;
  await transaction(async (c) => {
    if (
      (
        await c.query(
          "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
          [q.account.id, other],
        )
      ).rowCount
    )
      fail(403, "This conversation is blocked.");
    await c.query(
      "INSERT INTO messages(id,project_id,sender_id,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), p.id, q.account.id, body.body],
    );
    await notify(
      c,
      other,
      "New project message",
      "You have a new message about " + p.title + ".",
    );
  });
  res.json({ ok: true });
});
api.post("/projects/:id/call", async (req, res) => {
  const q = req as AuthRequest;
  const { audioOnly } = z
    .object({ audioOnly: z.boolean() })
    .strict()
    .parse(q.body);
  const p = await memberProject(String(q.params.id), q.account);
  if (!p.proId) fail(409, "A professional has not been assigned.");
  if (["cancelled", "disputed"].includes(p.status))
    fail(409, "Calls are unavailable for this project.");
  const other = q.account.id === p.customerId ? p.proId : p.customerId;
  if (
    (
      await pool.query(
        "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
        [q.account.id, other],
      )
    ).rowCount
  )
    fail(403, "This conversation is blocked.");
  const room = await meeting(p.id, q.account.id, q.account.name, audioOnly);
  await transaction((c) =>
    notify(
      c,
      other,
      "Join a project call",
      "Open " + p.title + " and select the call button to join.",
    ),
  );
  res.json(room);
});
api.post("/projects/:id/review", async (req, res) => {
  const q = req as AuthRequest;
  const p = await memberProject(String(q.params.id), q.account);
  const data = z
    .object({
      rating: z.number().int().min(1).max(5),
      body: z.string().trim().min(10).max(2000),
    })
    .strict()
    .parse(q.body);
  if (q.account.id !== p.customerId || p.status !== "completed" || !p.proId)
    fail(403, "Only the customer can review completed work.");
  await pool.query(
    "INSERT INTO reviews(id,project_id,pro_id,rating,body) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), p.id, p.proId, data.rating, data.body],
  );
  res.json({ ok: true });
});
api.post("/reviews/:id/reply", async (req, res) => {
  const q = req as AuthRequest;
  const { reply } = z
    .object({ reply: z.string().trim().min(2).max(1500) })
    .strict()
    .parse(q.body);
  if (
    !(
      await pool.query(
        "UPDATE reviews SET reply=$3 WHERE id=$1 AND pro_id=$2 RETURNING id",
        [z.string().uuid().parse(q.params.id), q.account.id, reply],
      )
    ).rowCount
  )
    fail(403, "You can reply only to your own reviews.");
  res.json({ ok: true });
});
api.post("/saved/:id", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "customer") fail(403, "Customer account required.");
  const { saved } = z.object({ saved: z.boolean() }).strict().parse(q.body);
  if (saved)
    await pool.query(
      "INSERT INTO saved(user_id,pro_id) SELECT $1,id FROM profiles WHERE id=$2 AND verified AND NOT suspended ON CONFLICT DO NOTHING",
      [q.account.id, q.params.id],
    );
  else
    await pool.query("DELETE FROM saved WHERE user_id=$1 AND pro_id=$2", [
      q.account.id,
      q.params.id,
    ]);
  res.json({ ok: true });
});
api.post("/blocked/:id", async (req, res) => {
  const q = req as AuthRequest;
  const { blocked } = z.object({ blocked: z.boolean() }).strict().parse(q.body);
  if (q.params.id === q.account.id) fail(400, "Choose another account.");
  if (
    !(
      await pool.query(
        "SELECT 1 FROM projects p LEFT JOIN project_discussions d ON d.project_id=p.id WHERE (p.customer_id=$1 AND (p.pro_id=$2 OR d.pro_id=$2)) OR (p.customer_id=$2 AND (p.pro_id=$1 OR d.pro_id=$1))",
        [q.account.id, q.params.id],
      )
    ).rowCount
  )
    fail(403, "No shared project.");
  if (blocked)
    await pool.query(
      "INSERT INTO blocked VALUES($1,$2) ON CONFLICT DO NOTHING",
      [q.account.id, q.params.id],
    );
  else
    await pool.query("DELETE FROM blocked WHERE user_id=$1 AND other_id=$2", [
      q.account.id,
      q.params.id,
    ]);
  res.json({ ok: true });
});
api.post("/notifications/read", async (req, res) => {
  await pool.query("UPDATE notifications SET read=true WHERE user_id=$1", [
    (req as AuthRequest).account.id,
  ]);
  res.json({ ok: true });
});
api.post("/support", async (req, res) => {
  const q = req as AuthRequest;
  const data = z
    .object({
      subject: z.string().trim().min(5).max(120),
      body: z.string().trim().min(10).max(3000),
    })
    .strict()
    .parse(q.body);
  await pool.query(
    "INSERT INTO tickets(id,user_id,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), q.account.id, data.subject, data.body],
  );
  res.json({ ok: true });
});
api.get("/location/:zip", async (req, res) =>
  res.json(
    await locate(
      z
        .string()
        .regex(/^\d{5}$/)
        .parse(req.params.zip),
    ),
  ),
);
// Retired project-payment routes fail closed for old clients.
api.post(["/projects/:id/checkout", "/profile/connect"], () => {
  fail(
    410,
    "Aplime does not process payments between customers and professionals.",
  );
});
api.post("/profile/identity", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "pro") fail(403, "Professional account required.");
  const result = await transaction(async (c) => {
    const p = (
      await c.query("SELECT * FROM profiles WHERE id=$1 FOR UPDATE", [
        q.account.id,
      ])
    ).rows[0];
    if (!p) fail(409, "Save your business profile first.");
    if (p.verified) fail(409, "Identity is already verified.");
    if (p.identity_session_id) {
      const old = await stripe().identity.verificationSessions.retrieve(
        p.identity_session_id,
      );
      if (old.status === "processing")
        fail(409, "Verification is processing. Please check back shortly.");
      if (old.status === "requires_input" && old.url) return { url: old.url };
    }
    const session = await stripe().identity.verificationSessions.create(
      {
        type: "document",
        metadata: { userId: q.account.id },
        options: { document: { require_matching_selfie: true } },
        return_url: env.SITE_URL + "/app/profile",
      },
      {
        idempotencyKey:
          "identity:" +
          q.account.id +
          ":" +
          (p.identity_session_id || "initial"),
      },
    );
    await c.query("UPDATE profiles SET identity_session_id=$2 WHERE id=$1", [
      q.account.id,
      session.id,
    ]);
    return { url: session.url };
  });
  res.json(result);
});
api.get("/payments/:id/receipt", async (req, res) => {
  const q = req as AuthRequest;
  const row = (
    await pool.query(
      "SELECT pay.*,p.customer_id,p.pro_id FROM payments pay JOIN projects p ON p.id=pay.project_id WHERE pay.id=$1",
      [z.string().uuid().parse(q.params.id)],
    )
  ).rows[0];
  if (
    !row ||
    !(
      q.account.role === "admin" ||
      row.customer_id === q.account.id ||
      row.pro_id === q.account.id
    )
  )
    fail(403, "This receipt is private.");
  if (!row.intent_id) fail(409, "A receipt is not available yet.");
  const intent = await stripe().paymentIntents.retrieve(row.intent_id, {
    expand: ["latest_charge"],
  });
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string" || !charge.receipt_url)
    fail(404, "Receipt not available.");
  res.json({ url: charge.receipt_url });
});
api.post("/projects/:id/uploads", async (req, res) => {
  const q = req as AuthRequest;
  const p = await memberProject(String(q.params.id), q.account);
  const data = uploadSchema.parse(q.body);
  const id = randomUUID(),
    key = env.APP_ENV + "/" + p.id + "/" + id;
  const url = await uploadUrl(key, data.contentType, data.size);
  await reserveUpload(id, p.id, q.account.id, key, data);
  res.json({ id, url });
});
api.delete("/uploads/:id", async (req, res) => {
  const q = req as AuthRequest;
  await transaction(async (c) => {
    const f = (
      await c.query(
        "SELECT * FROM uploads WHERE id=$1 AND user_id=$2 AND status='pending' FOR UPDATE",
        [z.string().uuid().parse(q.params.id), q.account.id],
      )
    ).rows[0];
    if (!f) fail(404, "Unfinished upload not found.");
    await memberProject(f.project_id, q.account);
    await removeObject(f.object_key);
    await c.query("DELETE FROM uploads WHERE id=$1", [f.id]);
  });
  res.json({ ok: true });
});
api.post("/uploads/:id/retry", async (req, res) => {
  const q = req as AuthRequest;
  const f = (
    await pool.query("SELECT * FROM uploads WHERE id=$1 AND user_id=$2", [
      z.string().uuid().parse(q.params.id),
      q.account.id,
    ])
  ).rows[0];
  if (!f) fail(404, "Upload not found.");
  await memberProject(f.project_id, q.account);
  res.json({
    id: f.id,
    ready: f.status === "ready",
    url:
      f.status === "ready"
        ? undefined
        : await uploadUrl(f.object_key, f.content_type, f.size),
  });
});
api.post("/uploads/:id/complete", async (req, res) => {
  const q = req as AuthRequest;
  await transaction(async (c) => {
    const f = (
      await c.query(
        "SELECT * FROM uploads WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [z.string().uuid().parse(q.params.id), q.account.id],
      )
    ).rows[0];
    if (!f) fail(404, "Upload not found.");
    await memberProject(f.project_id, q.account);
    if (f.status === "ready") return;
    const head = await inspectObject(f.object_key);
    if (head.ContentLength !== f.size || head.ContentType !== f.content_type) {
      await removeObject(f.object_key);
      fail(400, "Uploaded file does not match its declared type or size.");
    }
    await c.query("UPDATE uploads SET status='ready' WHERE id=$1", [f.id]);
  });
  res.json({ ok: true });
});
api.get("/uploads/:id", async (req, res) => {
  const q = req as AuthRequest;
  const f = (
    await pool.query("SELECT * FROM uploads WHERE id=$1 AND status='ready'", [
      z.string().uuid().parse(q.params.id),
    ])
  ).rows[0];
  if (!f) fail(404, "File not found.");
  await memberProject(f.project_id, q.account);
  res.json({ url: await downloadUrl(f.object_key) });
});
api.use("/admin", (req, _res, next) => {
  if ((req as AuthRequest).account.role !== "admin")
    fail(403, "Administrator access required.");
  next();
});
api.get("/admin/workspace", async (q, r) => r.json(await workspace(q.account)));
api.post("/admin/profiles/:id", async (req, res) => {
  const q = req as AuthRequest;
  const { suspended } = z
    .object({ suspended: z.boolean() })
    .strict()
    .parse(q.body);
  await transaction(async (c) => {
    if (
      !(
        await c.query(
          "UPDATE profiles SET suspended=$2 WHERE id=$1 RETURNING id",
          [q.params.id, suspended],
        )
      ).rowCount
    )
      fail(404, "Professional not found.");
    await audit(
      c,
      q.account.id,
      suspended ? "suspend" : "restore",
      String(q.params.id),
    );
  });
  res.json({ ok: true });
});
api.post("/admin/tickets/:id", async (req, res) => {
  const q = req as AuthRequest;
  const { resolution, refund } = z
    .object({
      resolution: z.string().trim().min(10).max(3000),
      refund: z.boolean(),
    })
    .strict()
    .parse(q.body);
  await transaction(async (c) => {
    const t = (
      await c.query("SELECT * FROM tickets WHERE id=$1 FOR UPDATE", [
        z.string().uuid().parse(q.params.id),
      ])
    ).rows[0];
    if (!t || t.status !== "open")
      fail(409, "This case is already closed or unavailable.");
    if (refund) {
      if (!t.project_id) fail(400, "This case has no payment.");
      await getProject(c, t.project_id);
      const pay = (
        await c.query("SELECT * FROM payments WHERE project_id=$1 FOR UPDATE", [
          t.project_id,
        ])
      ).rows[0];
      if (!pay?.intent_id || pay.status !== "paid")
        fail(409, "No refundable payment.");
      const refundResult = await stripe().refunds.create(
        {
          payment_intent: pay.intent_id,
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: "refund:" + pay.id },
      );
      if (refundResult.status !== "succeeded")
        fail(
          409,
          "Refund submitted and processing. Wait for Stripe confirmation before resolving this case.",
        );
      await c.query("UPDATE payments SET status='refunded' WHERE id=$1", [
        pay.id,
      ]);
      await c.query("UPDATE projects SET status='cancelled' WHERE id=$1", [
        t.project_id,
      ]);
    } else if (t.project_id)
      await c.query(
        "UPDATE projects SET status=COALESCE(previous_status,'completed'),previous_status=NULL WHERE id=$1 AND status='disputed'",
        [t.project_id],
      );
    await c.query(
      "UPDATE tickets SET status='resolved',resolution=$2 WHERE id=$1",
      [t.id, resolution],
    );
    await audit(c, q.account.id, refund ? "refund" : "resolve", t.id);
    await notify(c, t.user_id, "Support case resolved", resolution);
  });
  res.json({ ok: true });
});
