import { identityVerification } from "./identity-verification.js";
import { adminConsole } from "./admin-console.js";
import { supportRouter } from "./support.js";
import { preferencesSchema } from "../shared/preferences.js";
import { hasBusinessBranding } from "../shared/business-images.js";
import {
  recordProjectActivity,
  readProjectActivity,
  notifyProjectMembers,
  notifyMatchingProfessionals,
} from "./project-events.js";
import { autocompleteAddress, locateAddress } from "./integrations/address.js";
import {
  assertIndependentParties,
  assertMatch,
  isOpenLead,
} from "./matching.js";
import { assertAppointment } from "./scheduling.js";
import { businessImages, publicBusinessImages } from "./business-images.js";
import { notificationStream } from "./notification-stream.js";
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
  notifyAdministrators,
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
  imageUrl,
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
api.use(publicBusinessImages);
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
  await transaction(async (c) => {
    const created = await c.query(
      "INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id",
      [q.identity.uid, q.identity.email, data.name, data.role],
    );
    if (created.rowCount)
      await notify(
        c,
        q.identity.uid,
        "Welcome to Aplime",
        data.role === "pro"
          ? "Complete your business profile, identity verification, and subscription to respond to opportunities."
          : "Create a project or find a professional to get started.",
        { page: data.role === "pro" ? "profile" : "dashboard" },
      );
  });
  res.status(201).json({ ok: true });
});
api.use((req, _res, next) => {
  if (!(req as AuthRequest).account) fail(428, "Complete your account setup.");
  next();
});
api.get("/notifications/stream", notificationStream);
api.use("/subscription", subscriptions);
api.use("/support", supportRouter(false));
api.get("/workspace", async (q, r) =>
  r.json(await workspace((q as AuthRequest).account)),
);
api.get("/locations/autocomplete", async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().min(3).max(200),
      sessionToken: z.string().uuid(),
    })
    .parse(req.query);
  res.json(await autocompleteAddress(q.q, q.sessionToken));
});
api.get("/locations/details", async (req, res) => {
  const q = z
    .object({
      placeId: z.string().min(3).max(300),
      sessionToken: z.string().uuid(),
    })
    .parse(req.query);
  res.json(await locateAddress(q.placeId, q.sessionToken));
});
api.put("/profile/preferences", async (req, res) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  const p = preferencesSchema.parse(req.body);
  await transaction(async (c) => {
    const updated = await c.query(
      "UPDATE profiles SET service_categories=$2,service_radius_miles=$3,available=$4,weekly_hours=$5,time_zone=$6,availability=$7 WHERE id=$1 RETURNING id",
      [
        req.account.id,
        JSON.stringify([...new Set(p.serviceCategories)]),
        p.serviceRadiusMiles,
        p.available,
        JSON.stringify(p.weeklyHours),
        p.timeZone,
        JSON.stringify(Object.keys(p.weeklyHours)),
      ],
    );
    if (!updated.rowCount) fail(409, "Save your business profile first.");
    await notify(
      c,
      req.account.id,
      "Preferences updated",
      "Your project matches and published hours now use your saved preferences.",
      { page: "availability" },
    );
  });
  res.json({ ok: true });
});
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
// Stable stringify so jsonb key reordering never looks like an edit.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
api.put("/profile", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "pro") fail(403, "Professional account required.");
  const p = profileSchema.parse(q.body);
  const location = await locateAddress(p.placeId);
  if (!location) fail(400, "Select a complete street address.");
  await transaction(async (c) => {
    const existing = (
      await c.query("SELECT * FROM profiles WHERE id=$1 FOR UPDATE", [
        q.account.id,
      ])
    ).rows[0];
    // Customer-facing listing content needs review; availability, schedule
    // and service-radius changes are operational and never unlist a business.
    const material =
      !existing ||
      existing.business !== p.business ||
      existing.category !== p.category ||
      existing.bio !== p.bio ||
      Number(existing.rate) !== p.rate ||
      existing.place_id !== location.placeId ||
      canonical(existing.details) !== canonical(p.details);
    await c.query(
      "INSERT INTO profiles(id,business,category,bio,zip,rate,available,availability,details,service_radius_miles,latitude,longitude,address,place_id,service_categories) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,jsonb_build_array($3::text)) ON CONFLICT(id) DO UPDATE SET business=$2,category=$3,bio=$4,zip=$5,rate=$6,available=$7,availability=$8,details=$9,service_radius_miles=$10,latitude=$11,longitude=$12,address=$13,place_id=$14",
      [
        q.account.id,
        p.business,
        p.category,
        p.bio,
        location.zip,
        p.rate,
        p.available,
        JSON.stringify(p.availability),
        JSON.stringify(p.details),
        p.serviceRadiusMiles,
        location.lat,
        location.lng,
        location.label,
        location.placeId,
      ],
    );
    if (material) {
      // A listed business stays visible while its edits are re-reviewed;
      // unlisted ones return to draft and resubmit manually.
      const relist =
        !!existing &&
        (existing.listed || existing.review_status === "approved");
      await c.query(
        relist
          ? "UPDATE profiles SET review_status='pending',review_note=NULL,submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL WHERE id=$1"
          : "UPDATE profiles SET review_status='draft',review_note=NULL,submitted_at=NULL,reviewed_at=NULL,reviewed_by=NULL WHERE id=$1",
        [q.account.id],
      );
      if (relist)
        await notifyAdministrators(
          c,
          "Listed business profile updated",
          p.business +
            " changed its live listing. Review the updates in the administrator console.",
        );
    }
  });
  res.json({ ok: true });
});
api.post("/profile/submit-review", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "pro") fail(403, "Professional account required.");
  await transaction(async (c) => {
    const profile = (
      await c.query(
        "SELECT p.*,COALESCE(array_agg(i.slot) FILTER (WHERE i.slot IS NOT NULL),ARRAY[]::text[]) AS ready_slots FROM profiles p LEFT JOIN business_images i ON i.profile_id=p.id AND i.status='ready' WHERE p.id=$1 GROUP BY p.id",
        [q.account.id],
      )
    ).rows[0];
    if (!profile) fail(409, "Save your business details first.");
    if (!profile.verified) fail(409, "Complete identity verification first.");
    if (!hasBusinessBranding(profile.ready_slots))
      fail(409, "Add your business logo and advertising image before review.");
    if (profile.review_status === "pending")
      fail(409, "Your business profile is already under review.");
    await c.query(
      "UPDATE profiles SET review_status='pending',review_note=NULL,submitted_at=now() WHERE id=$1",
      [q.account.id],
    );
    await notifyAdministrators(
      c,
      "Business profile ready for review",
      profile.business + " submitted its marketplace listing.",
    );
    await audit(c, q.account.id, "submit_profile_review", q.account.id);
  });
  res.json({ ok: true });
});
api.use("/profile/images", businessImages);
api.use(discussions);
const projectDraftSchema = z.record(z.string().max(64), z.unknown());
api.get("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const row = (
    await pool.query(
      "SELECT payload,updated_at FROM project_drafts WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0];
  res.json(row ? camel(row) : { payload: null, updatedAt: null });
});
api.put("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  const payload = projectDraftSchema.parse(req.body);
  if (JSON.stringify(payload).length > 30000) fail(413, "Draft is too large.");
  await pool.query(
    "INSERT INTO project_drafts(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=$2,updated_at=now()",
    [req.account.id, JSON.stringify(payload)],
  );
  res.json({ ok: true });
});
api.delete("/project-draft", async (req, res) => {
  if (req.account.role !== "customer") fail(403, "Customer account required.");
  await pool.query("DELETE FROM project_drafts WHERE user_id=$1", [
    req.account.id,
  ]);
  res.json({ ok: true });
});
api.post("/projects", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "customer") fail(403, "Customer account required.");
  const p = projectSchema.parse(q.body);
  assertFuture(p.scheduledAt);
  const location = await locateAddress(p.placeId);
  if (!location) fail(400, "Select a complete street address.");
  const id = randomUUID();
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO projects(id,customer_id,pro_id,title,description,category,zip,scheduled_at,intake,urgency,property_type,budget_min,budget_max,latitude,longitude,address,place_id,address_unit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)",
      [
        id,
        q.account.id,
        p.proId,
        p.title,
        p.description,
        p.category,
        location.zip,
        null,
        JSON.stringify(p.intake),
        p.urgency,
        p.propertyType,
        p.budgetMin,
        p.budgetMax,
        location.lat,
        location.lng,
        location.label,
        location.placeId,
        p.addressUnit,
      ],
    );
    if (p.proId) await assertMatch(c, p.proId, id);
    if (p.scheduledAt) await assertAppointment(c, p.proId, p.scheduledAt, id);
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
    if (!p.proId) await notifyMatchingProfessionals(c, id);
    const created = await getProject(c, id);
    await recordProjectActivity(
      c,
      id,
      q.account.id,
      "publish",
      "Project published",
    );
    await notifyProjectMembers(
      c,
      created,
      "Project published",
      p.title + ": your project is ready for discussion.",
    );
  });
  res.status(201).json({ id });
});
api.post("/projects/:id/actions", async (req, res) => {
  const { expectedVersion, ...action } = z
    .object({ expectedVersion: z.number().int().positive() })
    .passthrough()
    .parse(req.body);
  res.json(
    await projectAction(
      z.string().uuid().parse(req.params.id),
      (req as AuthRequest).account,
      actionSchema.parse(action),
      expectedVersion,
    ),
  );
});
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
api.get("/projects/:id/activity", async (req, res) => {
  res.json(
    await readProjectActivity(
      z.string().uuid().parse(req.params.id),
      req.account.id,
    ),
  );
});
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
      { page: "messages", id: p.id },
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
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO call_events(id,project_id,actor_id,mode) VALUES($1,$2,$3,$4)",
      [randomUUID(), p.id, q.account.id, audioOnly ? "audio" : "video"],
    );
    await notify(
      c,
      other,
      "Join a project call",
      "Open " + p.title + " and select the call button to join.",
      { page: "messages", id: p.id },
    );
  });
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
  await transaction(async (c) => {
    await assertIndependentParties(c, p.customerId, p.proId!);
    if (
      (
        await c.query(
          "SELECT 1 FROM reviews r JOIN projects pj ON pj.id=r.project_id WHERE pj.customer_id=$1 AND r.pro_id=$2 AND r.created_at>now()-interval '30 days'",
          [p.customerId, p.proId],
        )
      ).rowCount
    )
      fail(
        429,
        "You already reviewed this professional recently. Reviews for the same professional are limited to one every 30 days.",
      );
    await c.query(
      "INSERT INTO reviews(id,project_id,pro_id,rating,body) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), p.id, p.proId, data.rating, data.body],
    );
    await notify(
      c,
      p.proId,
      "New customer review",
      p.title + ": a customer shared their experience.",
      { page: "reviews" },
    );
  });
  res.json({ ok: true });
});
api.post("/reviews/:id/reply", async (req, res) => {
  const q = req as AuthRequest;
  const { reply } = z
    .object({ reply: z.string().trim().min(2).max(1500) })
    .strict()
    .parse(q.body);
  await transaction(async (c) => {
    const r = (
      await c.query(
        "UPDATE reviews SET reply=$3 WHERE id=$1 AND pro_id=$2 RETURNING project_id",
        [z.string().uuid().parse(q.params.id), q.account.id, reply],
      )
    ).rows[0];
    if (!r) fail(403, "You can reply only to your own reviews.");
    const p = (
      await c.query("SELECT customer_id FROM projects WHERE id=$1", [
        r.project_id,
      ])
    ).rows[0];
    await notify(
      c,
      p.customer_id,
      "Professional replied to your review",
      "Open your reviews to read the response.",
      { page: "reviews" },
    );
  });
  res.json({ ok: true });
});
api.post("/saved/:id", async (req, res) => {
  const q = req as AuthRequest;
  if (q.account.role !== "customer") fail(403, "Customer account required.");
  const { saved } = z.object({ saved: z.boolean() }).strict().parse(q.body);
  if (saved) {
    const inserted = await pool.query(
      "INSERT INTO saved(user_id,pro_id) SELECT $1,id FROM profiles WHERE id=$2 AND NOT suspended ON CONFLICT DO NOTHING",
      [q.account.id, q.params.id],
    );
    if (
      !inserted.rowCount &&
      !(
        await pool.query("SELECT 1 FROM saved WHERE user_id=$1 AND pro_id=$2", [
          q.account.id,
          q.params.id,
        ])
      ).rowCount
    )
      fail(404, "This professional is not available to save.");
  } else
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
api.post("/notifications/:id/read", async (req, res) => {
  await pool.query(
    "UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 AND NOT read",
    [z.string().uuid().parse(req.params.id), req.account.id],
  );
  res.json({ ok: true });
});
api.post("/notifications/read", async (req, res) => {
  await pool.query(
    "UPDATE notifications SET read=true WHERE user_id=$1 AND NOT read",
    [(req as AuthRequest).account.id],
  );
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
  await transaction(async (c) => {
    await c.query(
      "INSERT INTO tickets(id,user_id,subject,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), q.account.id, data.subject, data.body],
    );
    await notifyAdministrators(
      c,
      "New support request",
      "A user opened a support request. Review it in the administrator console.",
    );
    await notify(
      c,
      q.account.id,
      "Support request received",
      "Your support request was saved. View its status in Help.",
      { page: "help" },
    );
  });
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
api.use("/profile/identity", identityVerification);
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
    const p = await memberProject(f.project_id, q.account);
    await notify(
      c,
      p.customerId === q.account.id ? p.proId : p.customerId,
      "New project attachment",
      "A participant added a file to " + p.title + ".",
      { page: "project", id: p.id },
    );
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
  const openLead =
    q.account.role === "pro" &&
    String(f.content_type).startsWith("image/") &&
    (await isOpenLead(q.account.id, f.project_id));
  if (!openLead) await memberProject(f.project_id, q.account);
  // Images open inline so participants can view photos in the browser;
  // documents keep the attachment disposition.
  const inline = String(f.content_type).startsWith("image/");
  res.json({
    url: inline
      ? await imageUrl(f.object_key)
      : await downloadUrl(f.object_key),
    inline,
  });
});
api.use("/admin", (req, _res, next) => {
  if ((req as AuthRequest).account.role !== "admin")
    fail(403, "Administrator access required.");
  next();
});
api.get("/admin/notifications/stream", notificationStream);
api.post("/admin/notifications/read", async (req, res) => {
  await pool.query(
    "UPDATE notifications SET read=true WHERE user_id=$1 AND NOT read",
    [req.account.id],
  );
  res.json({ ok: true });
});
api.get("/admin/workspace", async (q, r) => r.json(await workspace(q.account)));
api.use("/admin", adminConsole);
api.use("/admin/support", supportRouter(true));
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
    await notify(
      c,
      String(q.params.id),
      suspended ? "Business profile suspended" : "Business profile restored",
      "Open your business profile or contact support for help.",
      { page: "profile" },
    );
  });
  res.json({ ok: true });
});
api.post("/admin/profiles/:id/review", async (req, res) => {
  const q = req as AuthRequest;
  const decision = z
    .object({
      status: z.enum(["approved", "changes_requested", "rejected"]),
      note: z.string().trim().max(2000),
    })
    .strict()
    .parse(q.body);
  if (decision.status !== "approved" && decision.note.length < 10)
    fail(400, "Explain what the professional needs to change.");
  await transaction(async (c) => {
    const profile = (
      await c.query(
        "UPDATE profiles SET review_status=$2,listed=($2='approved'),review_note=NULLIF($3,''),reviewed_at=now(),reviewed_by=$4 WHERE id=$1 AND review_status='pending' RETURNING business",
        [q.params.id, decision.status, decision.note, q.account.id],
      )
    ).rows[0];
    if (!profile) fail(409, "This profile is not awaiting review.");
    await audit(
      c,
      q.account.id,
      "profile_review_" + decision.status,
      String(q.params.id),
    );
    await notify(
      c,
      String(q.params.id),
      decision.status === "approved"
        ? "Business profile approved"
        : "Business profile review updated",
      decision.status === "approved"
        ? "Your listing is approved. Keep your subscription active and availability current to appear in search."
        : decision.note,
      { page: "profile" },
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
        "UPDATE projects SET status=COALESCE(previous_status,'completed'),previous_status=NULL,version=version+1 WHERE id=$1 AND status='disputed'",
        [t.project_id],
      );
    await c.query(
      "UPDATE tickets SET status='resolved',resolution=$2 WHERE id=$1",
      [t.id, resolution],
    );
    await audit(c, q.account.id, refund ? "refund" : "resolve", t.id);
    await notify(c, t.user_id, "Support case resolved", resolution, {
      page: "help",
      id: t.id,
    });
    if (t.project_id) {
      const p = await getProject(c, t.project_id);
      await recordProjectActivity(
        c,
        p.id,
        q.account.id,
        "resolve_issue",
        "Support case resolved",
        resolution,
      );
      await notify(
        c,
        t.user_id === p.customerId ? p.proId : p.customerId,
        "Project issue resolved",
        "Open your project for its updated status.",
        { page: "project", id: p.id },
      );
    }
  });
  res.json({ ok: true });
});
