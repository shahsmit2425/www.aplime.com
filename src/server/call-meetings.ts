import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type pg from "pg";
import { pool, transaction, camel } from "./db/index.js";
import { getProject, notify } from "./repository.js";
import { assertMatch, assertIndependentParties } from "./matching.js";
import { ensurePairConversation } from "./discussions.js";
import { recordProjectActivity } from "./project-events.js";
import { fail } from "./errors.js";
import { meeting } from "./integrations/daily.js";
import { closeDueMeetings } from "./meeting-lifecycle.js";
import { withinWeeklyHours } from "../shared/preferences.js";
import {
  CALL_MINUTES,
  CALL_HORIZON_DAYS,
  callRequestSchema,
  callActionSchema,
  callCanJoin,
  type CallMeeting,
} from "../shared/meetings.js";
import type { Project, User } from "../shared/domain.js";
export const callMeetings = Router();
const select = `SELECT m.*,p.title,f.business,u.name AS customer_name FROM scheduled_calls m JOIN projects p ON p.id=m.project_id JOIN profiles f ON f.id=m.pro_id JOIN users u ON u.id=m.customer_id`;
function member(m: { customerId: string; proId: string }, user: User) {
  if (user.id !== m.customerId && user.id !== m.proId)
    fail(404, "Meeting unavailable.");
}
function future(value: string, leadMinutes = 15) {
  const t = Date.parse(value),
    now = Date.now();
  if (
    t <= now + leadMinutes * 60000 ||
    t > now + CALL_HORIZON_DAYS * 86400000 ||
    t % (CALL_MINUTES * 60000) !== 0
  )
    fail(
      409,
      `Choose an available 10-minute slot ${leadMinutes ? "at least 15 minutes ahead" : "in the future"}, within the next 21 days.`,
    );
}
async function maySchedule(
  c: pg.PoolClient,
  p: Project,
  proId: string,
  user: User,
) {
  member({ customerId: p.customerId, proId }, user);
  if (
    ["completed", "cancelled", "disputed"].includes(p.status) ||
    (p.proId && p.proId !== proId)
  )
    fail(409, "Calls cannot be scheduled for this project.");
  if (
    (
      await c.query(
        "SELECT 1 FROM blocked WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)",
        [p.customerId, proId],
      )
    ).rowCount
  )
    fail(403, "This conversation is blocked.");
  if (
    (await c.query("SELECT 1 FROM profiles WHERE id=$1 AND suspended", [proId]))
      .rowCount
  )
    fail(403, "This business is unavailable.");
  if (p.proId !== proId) await assertMatch(c, proId, p.id);
  await assertIndependentParties(c, p.customerId, proId);
}
async function calendar(
  c: pg.PoolClient,
  proId: string,
  customerId: string,
  exclude?: string,
  lock = false,
) {
  // Shares the profile lock with site visits; ordered user locks serialize a
  // customer's simultaneous confirmations with different professionals.
  const profile = (
    await c.query(
      "SELECT weekly_hours,time_zone FROM profiles WHERE id=$1" +
        (lock ? " FOR UPDATE" : ""),
      [proId],
    )
  ).rows[0];
  if (!profile) fail(404, "Business unavailable.");
  if (lock)
    await c.query(
      "SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [[proId, customerId]],
    );
  const busy = (
    await c.query(
      `SELECT starts_at AS start, starts_at+make_interval(mins => $4::int) AS finish FROM scheduled_calls
    WHERE status='confirmed' AND (pro_id=$1 OR customer_id=$2) AND ($3::uuid IS NULL OR id<>$3) AND starts_at+make_interval(mins => $4::int)>now()
    UNION ALL SELECT scheduled_at,scheduled_at+interval '1 hour' FROM projects WHERE (pro_id=$1 OR customer_id=$2)
    AND status IN ('booked','in_progress','paused','disputed') AND scheduled_at+interval '1 hour'>now()`,
      [proId, customerId, exclude || null, CALL_MINUTES],
    )
  ).rows;
  return { profile, busy };
}
function available(t: number, profile: any, busy: any[]) {
  const end = t + CALL_MINUTES * 60000;
  return (
    withinWeeklyHours(
      new Date(t).toISOString(),
      profile.weekly_hours,
      profile.time_zone,
    ) &&
    withinWeeklyHours(
      new Date(end - 1).toISOString(),
      profile.weekly_hours,
      profile.time_zone,
    ) &&
    !busy.some((b) => Date.parse(b.start) < end && Date.parse(b.finish) > t)
  );
}
async function assertSlot(
  c: pg.PoolClient,
  p: Project,
  proId: string,
  value: string,
  exclude?: string,
  leadMinutes = 15,
) {
  future(value, leadMinutes);
  const { profile, busy } = await calendar(
    c,
    proId,
    p.customerId,
    exclude,
    true,
  );
  if (!available(Date.parse(value), profile, busy))
    fail(409, "That time is no longer available. Choose another slot.");
}
callMeetings.get("/call-meetings", async (req, res) => {
  await closeDueMeetings(req.account.id);
  res.setHeader("Cache-Control", "no-store");
  res.json(
    (
      await pool.query(
        select +
          " WHERE m.customer_id=$1 OR m.pro_id=$1 ORDER BY (m.status IN ('requested','confirmed')) DESC,m.starts_at DESC LIMIT 200",
        [req.account.id],
      )
    ).rows.map((r) => camel<CallMeeting>(r)),
  );
});
callMeetings.get(
  "/projects/:projectId/professionals/:proId/call-slots",
  async (req, res) => {
    const projectId = z.string().uuid().parse(req.params.projectId),
      proId = z.string().min(1).max(128).parse(req.params.proId);
    const exclude = z.string().uuid().optional().parse(req.query.meetingId);
    const result = await transaction(async (c) => {
      const p = await getProject(c, projectId);
      await maySchedule(c, p, proId, req.account);
      if (exclude) {
        const m = camel<CallMeeting>(
          (
            await c.query("SELECT * FROM scheduled_calls WHERE id=$1", [
              exclude,
            ])
          ).rows[0] || {},
        );
        member(m, req.account);
        if (m.projectId !== projectId || m.proId !== proId)
          fail(404, "Meeting unavailable.");
      }
      const { profile, busy } = await calendar(c, proId, p.customerId, exclude);
      const slots: string[] = [],
        now = Date.now(),
        step = CALL_MINUTES * 60000;
      for (
        let t = Math.ceil((now + 15 * 60000) / step) * step;
        t <= now + CALL_HORIZON_DAYS * 86400000;
        t += step
      )
        if (available(t, profile, busy)) slots.push(new Date(t).toISOString());
      return { slots, timeZone: profile.time_zone, minutes: CALL_MINUTES };
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  },
);
callMeetings.post("/call-meetings", async (req, res) => {
  const b = callRequestSchema.parse(req.body);
  await closeDueMeetings(req.account.id);
  const result = await transaction(async (c) => {
    const p = await getProject(c, b.projectId);
    await maySchedule(c, p, b.proId, req.account);
    const existing = (
      await c.query("SELECT * FROM scheduled_calls WHERE id=$1", [b.id])
    ).rows[0];
    if (existing) {
      const m = camel<CallMeeting>(existing);
      member(m, req.account);
      if (
        m.projectId !== p.id ||
        m.proId !== b.proId ||
        Date.parse(m.startsAt) !== Date.parse(b.startsAt) ||
        m.mode !== b.mode
      )
        fail(409, "This meeting request changed. Please reopen scheduling.");
      return m;
    }
    await assertSlot(c, p, b.proId, b.startsAt);
    if (
      (
        await c.query(
          "SELECT 1 FROM scheduled_calls WHERE customer_id=$1 AND pro_id=$2 AND status IN ('requested','confirmed')",
          [p.customerId, b.proId],
        )
      ).rowCount
    )
      fail(
        409,
        "You already have an active meeting with this person. Manage it in Schedule before creating another.",
      );
    const thread = await ensurePairConversation(c, p.id, p.customerId, b.proId);
    const m = (
      await c.query(
        "INSERT INTO scheduled_calls(id,project_id,customer_id,pro_id,starts_at,mode,proposed_at,proposed_by) VALUES($1,$2,$3,$4,$5,$6,$5,$7) RETURNING *",
        [b.id, p.id, p.customerId, b.proId, b.startsAt, b.mode, req.account.id],
      )
    ).rows[0];
    await notify(
      c,
      req.account.id === p.customerId ? b.proId : p.customerId,
      "Call meeting requested",
      p.title + ": review the proposed time in Schedule.",
      { page: "schedule", id: b.id },
    );
    await recordProjectActivity(
      c,
      p.id,
      req.account.id,
      "call_requested",
      `A ${b.mode} call was requested.`,
    );
    return { ...camel(m), conversationId: thread.id };
  });
  res.json(result);
});
callMeetings.post("/call-meetings/:id/actions", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    a = callActionSchema.parse(req.body);
  await transaction(async (c) => {
    // Project lock comes first, matching all project/appointment mutations.
    const first = (
      await c.query("SELECT * FROM scheduled_calls WHERE id=$1", [id])
    ).rows[0];
    if (!first) fail(404, "Meeting unavailable.");
    member(camel<CallMeeting>(first), req.account);
    const p = await getProject(c, first.project_id);
    const m = camel<CallMeeting>(
      (
        await c.query("SELECT * FROM scheduled_calls WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0],
    );
    if (m.version !== a.expectedVersion)
      fail(409, "This meeting changed. Refresh before trying again.");
    if (!["requested", "confirmed"].includes(m.status))
      fail(409, "This meeting is closed.");
    let title = "Call meeting updated";
    if (a.type === "cancel") {
      await c.query(
        "UPDATE scheduled_calls SET status='cancelled',proposed_at=NULL,proposed_by=NULL WHERE id=$1",
        [id],
      );
      title = "Call meeting cancelled";
    } else if (a.type === "complete") {
      if (
        m.status !== "confirmed" ||
        Date.parse(m.startsAt) + CALL_MINUTES * 60000 > Date.now()
      )
        fail(409, "Only a finished confirmed meeting can be marked complete.");
      await c.query(
        "UPDATE scheduled_calls SET status='completed',proposed_at=NULL,proposed_by=NULL WHERE id=$1",
        [id],
      );
      title = "Call meeting completed";
    } else {
      await maySchedule(c, p, m.proId, req.account);
      if (a.type === "reschedule") {
        if (m.status === "confirmed" && Date.parse(m.startsAt) <= Date.now())
          fail(
            409,
            "This meeting has already started. Create a new meeting instead.",
          );
        await assertSlot(c, p, m.proId, a.startsAt, id);
        if (Date.parse(a.startsAt) === Date.parse(m.proposedAt || m.startsAt))
          fail(409, "Choose a different time.");
        await c.query(
          "UPDATE scheduled_calls SET proposed_at=$2,proposed_by=$3 WHERE id=$1",
          [id, a.startsAt, req.account.id],
        );
        title = "New call time proposed";
      } else {
        if (!m.proposedAt || m.proposedBy === req.account.id)
          fail(403, "Only the other participant can respond to this proposal.");
        if (a.accept) {
          await assertSlot(c, p, m.proId, m.proposedAt, id, 0);
          await c.query(
            "UPDATE scheduled_calls SET starts_at=proposed_at,status='confirmed',proposed_at=NULL,proposed_by=NULL WHERE id=$1",
            [id],
          );
          title = "Call meeting confirmed";
        } else {
          await c.query(
            "UPDATE scheduled_calls SET status=CASE WHEN status='requested' THEN 'declined' ELSE status END,proposed_at=NULL,proposed_by=NULL WHERE id=$1",
            [id],
          );
          title = "Call time declined";
        }
      }
    }
    await c.query(
      "UPDATE scheduled_calls SET version=version+1,updated_at=now() WHERE id=$1",
      [id],
    );
    await notify(
      c,
      req.account.id === m.customerId ? m.proId : m.customerId,
      title,
      p.title + ": open Schedule for the latest details.",
      { page: "schedule", id },
    );
    await recordProjectActivity(
      c,
      p.id,
      req.account.id,
      "call_" + a.type,
      title,
    );
  });
  res.json({ ok: true });
});
callMeetings.post("/call-meetings/:id/join", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await transaction(async (c) => {
    const row = (
      await c.query("SELECT * FROM scheduled_calls WHERE id=$1", [id])
    ).rows[0];
    if (!row) fail(404, "Meeting unavailable.");
    member(camel<CallMeeting>(row), req.account);
    const p = await getProject(c, row.project_id);
    const m = camel<CallMeeting>(
      (
        await c.query("SELECT * FROM scheduled_calls WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0],
    );
    await maySchedule(c, p, m.proId, req.account);
    if (!callCanJoin(m))
      fail(
        409,
        "Join opens at the confirmed start time and closes after 10 minutes.",
      );
    const thread = await ensurePairConversation(c, p.id, p.customerId, m.proId);
    return { m, thread };
  });
  const room = await meeting(
    result.m.id,
    req.account.id,
    req.account.name,
    result.m.mode === "audio",
    Date.parse(result.m.startsAt) + CALL_MINUTES * 60000,
  );
  await transaction(async (c) => {
    // Daily is an external request. Recheck after it returns so a cancellation,
    // reschedule or project closure during that request cannot release a link.
    const p = await getProject(c, result.m.projectId);
    const current = camel<CallMeeting>(
      (
        await c.query("SELECT * FROM scheduled_calls WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0],
    );
    await maySchedule(c, p, current.proId, req.account);
    if (current.version !== result.m.version || !callCanJoin(current))
      fail(409, "This meeting changed. Open Schedule for the latest details.");
    await c.query(
      "INSERT INTO call_events(id,project_id,discussion_id,actor_id,mode) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        result.m.projectId,
        result.thread.contextId,
        req.account.id,
        result.m.mode,
      ],
    );
    await notify(
      c,
      req.account.id === result.m.customerId
        ? result.m.proId
        : result.m.customerId,
      "Your call partner is joining",
      "Open Schedule to join your confirmed call.",
      { page: "schedule", id },
    );
  });
  res.json(room);
});
