import { notifyMatchingProfessionals } from "./project-events.js";
import { transaction } from "./db/index.js";
import { notifyOnce } from "./email-alerts.js";

// Bounded scans and unique receipts deduplicate multiple workers; delivery rechecks state.
export async function queueEmailReminders() {
  await transaction(async (c) => {
    // Only expand projects already enrolled in staged outreach; do not replay historical projects.
    const expand =
      await c.query(`SELECT p.id FROM projects p WHERE p.pro_id IS NULL AND p.status IN ('requested','quoted')
      AND EXISTS(SELECT 1 FROM project_outreach o WHERE o.project_id=p.id)
      AND (SELECT max(created_at) FROM project_outreach o WHERE o.project_id=p.id)<now()-interval '24 hours'
      AND (SELECT count(*) FROM project_outreach o WHERE o.project_id=p.id)<15
      AND (SELECT count(*) FROM (SELECT pro_id FROM quotes q WHERE q.project_id=p.id AND q.status='pending') responders)<3
      AND (p.outreach_checked_at IS NULL OR p.outreach_checked_at<now()-interval '24 hours')
      ORDER BY p.outreach_checked_at NULLS FIRST,p.created_at LIMIT 50 FOR UPDATE SKIP LOCKED`);
    for (const p of expand.rows) await notifyMatchingProfessionals(c, p.id);
    const awards =
      await c.query(`SELECT p.id,p.title,p.pro_id,p.customer_id,p.award_selected_at::text AS selection FROM projects p
      WHERE p.status='booked' AND NOT p.award_accepted AND p.award_selected_at<now()-interval '24 hours'
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=p.pro_id AND a.event_key='award-reminder:'||p.id||':'||p.award_selected_at::text)
      ORDER BY p.award_selected_at LIMIT 50`);
    for (const p of awards.rows)
      for (const uid of [p.pro_id, p.customer_id])
        await notifyOnce(
          c,
          uid,
          `award-reminder:${p.id}:${p.selection}`,
          "Job selection awaiting confirmation",
          uid === p.pro_id
            ? `${p.title}: confirm or decline the customer's selection. Work cannot start before you confirm.`
            : `${p.title}: the professional has not confirmed yet. You can keep waiting or withdraw your selection and compare other estimates.`,
          { page: "project", id: p.id },
        );
    const calls = (
      await c.query(`SELECT m.*,p.title FROM scheduled_calls m JOIN projects p ON p.id=m.project_id JOIN profiles f ON f.id=m.pro_id
      WHERE m.status='confirmed' AND m.starts_at>now() AND m.starts_at<=now()+interval '10 minutes'
      AND p.status IN ('requested','quoted','booked','in_progress') AND NOT f.suspended
      AND NOT EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=m.customer_id AND b.other_id=m.pro_id) OR (b.user_id=m.pro_id AND b.other_id=m.customer_id))
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=m.customer_id AND a.event_key='call-reminder:'||m.id||':'||m.version)
      ORDER BY m.starts_at LIMIT 50`)
    ).rows;
    for (const m of calls)
      for (const userId of [m.customer_id, m.pro_id])
        await notifyOnce(
          c,
          userId,
          `call-reminder:${m.id}:${m.version}`,
          "Your call starts soon",
          `${m.title}: your confirmed 10-minute call starts at ${new Date(m.starts_at).toISOString()} (UTC). Open Schedule to see your local time and join when available.`,
          { page: "schedule", id: m.id },
        );

    const visits = (
      await c.query(`SELECT p.*,p.scheduled_at::text AS reminder_time FROM projects p WHERE p.status='booked' AND p.award_accepted AND p.pro_id IS NOT NULL AND p.scheduled_at>now() AND p.scheduled_at<=now()+interval '24 hours'
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=p.customer_id AND a.event_key='visit-reminder:'||p.id||':'||p.scheduled_at::text)
      ORDER BY p.scheduled_at LIMIT 50`)
    ).rows;
    for (const p of visits)
      for (const userId of [p.customer_id, p.pro_id])
        await notifyOnce(
          c,
          userId,
          `visit-reminder:${p.id}:${p.reminder_time}`,
          "Upcoming site visit",
          `${p.title}: your confirmed visit is within 24 hours. Open Schedule for the exact date and local time.`,
          { page: "schedule", id: p.id },
        );

    const pending = (
      await c.query(`SELECT m.*,p.title FROM scheduled_calls m JOIN projects p ON p.id=m.project_id JOIN profiles f ON f.id=m.pro_id
      WHERE m.status='requested' AND m.proposed_by IS NOT NULL AND m.updated_at<now()-interval '24 hours'
      AND NOT f.suspended AND NOT EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=m.customer_id AND b.other_id=m.pro_id) OR (b.user_id=m.pro_id AND b.other_id=m.customer_id))
      AND p.status IN ('requested','quoted','booked','in_progress')
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=CASE WHEN m.proposed_by=m.customer_id THEN m.pro_id ELSE m.customer_id END AND a.event_key='pending-call:'||m.id||':'||m.version)
      ORDER BY m.updated_at LIMIT 50`)
    ).rows;
    for (const m of pending)
      await notifyOnce(
        c,
        m.proposed_by === m.customer_id ? m.pro_id : m.customer_id,
        `pending-call:${m.id}:${m.version}`,
        "Meeting request awaiting your response",
        `${m.title}: a call request is waiting for your response. Open Schedule to accept an available future time, suggest another time or decline. The request remains open until someone responds or cancels it.`,
        { page: "schedule", id: m.id },
      );

    const quotes = (
      await c.query(`SELECT q.id,q.revision,q.project_id,p.title,p.customer_id FROM quotes q JOIN projects p ON p.id=q.project_id
      WHERE q.status='pending' AND q.expires_at>now() AND q.expires_at<=now()+interval '24 hours' AND p.status IN ('requested','quoted')
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=p.customer_id AND a.event_key='estimate-reminder:'||q.id||':'||q.revision)
      ORDER BY q.expires_at LIMIT 50`)
    ).rows;
    for (const q of quotes)
      await notifyOnce(
        c,
        q.customer_id,
        `estimate-reminder:${q.id}:${q.revision}`,
        "An estimate expires soon",
        `${q.title}: an estimate expires within 24 hours. Review it before deciding.`,
        { page: "project", id: q.project_id },
      );

    const reviews = (
      await c.query(`SELECT p.id,p.title,p.customer_id FROM projects p WHERE p.status='completed'
      AND EXISTS(SELECT 1 FROM project_activity a WHERE a.project_id=p.id AND a.action='confirm_completion' AND a.created_at>now()-interval '7 days')
      AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.project_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM alert_event_receipts a WHERE a.user_id=p.customer_id AND a.event_key='review-invitation:'||p.id)
      ORDER BY p.created_at LIMIT 50`)
    ).rows;
    for (const p of reviews)
      await notifyOnce(
        c,
        p.customer_id,
        `review-invitation:${p.id}`,
        "How was your professional?",
        `${p.title} is complete. Share an honest review of your experience.`,
        { page: "project", id: p.id },
      );
  });
}

export async function reminderStillRelevant(
  key: string | null,
  c: { query: any },
) {
  if (!key) return true;
  const [kind, id, ...rest] = key.split(":");
  if (kind === "award-reminder")
    return !!(
      await c.query(
        "SELECT 1 FROM projects WHERE id=$1 AND status='booked' AND NOT award_accepted AND award_selected_at::text=$2",
        [id, rest.join(":")],
      )
    ).rowCount;
  if (kind === "call-reminder")
    return !!(
      await c.query(
        "SELECT 1 FROM scheduled_calls m JOIN projects p ON p.id=m.project_id JOIN profiles f ON f.id=m.pro_id WHERE m.id=$1 AND m.version=$2 AND m.status='confirmed' AND m.starts_at>now() AND p.status IN ('requested','quoted','booked','in_progress') AND NOT f.suspended AND NOT EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=m.customer_id AND b.other_id=m.pro_id) OR (b.user_id=m.pro_id AND b.other_id=m.customer_id))",
        [id, Number(rest[0])],
      )
    ).rowCount;
  if (kind === "pending-call")
    return !!(
      await c.query(
        "SELECT 1 FROM scheduled_calls m JOIN projects p ON p.id=m.project_id JOIN profiles f ON f.id=m.pro_id WHERE m.id=$1 AND m.version=$2 AND m.status='requested' AND p.status IN ('requested','quoted','booked','in_progress') AND NOT f.suspended AND NOT EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=m.customer_id AND b.other_id=m.pro_id) OR (b.user_id=m.pro_id AND b.other_id=m.customer_id))",
        [id, Number(rest[0])],
      )
    ).rowCount;
  if (kind === "visit-reminder")
    return !!(
      await c.query(
        "SELECT 1 FROM projects WHERE id=$1 AND status='booked' AND award_accepted AND scheduled_at::text=$2 AND scheduled_at>now()",
        [id, rest.join(":")],
      )
    ).rowCount;
  if (kind === "estimate-reminder")
    return !!(
      await c.query(
        "SELECT 1 FROM quotes q JOIN projects p ON p.id=q.project_id WHERE q.id=$1 AND q.revision=$2 AND q.status='pending' AND q.expires_at>now() AND p.status IN ('requested','quoted')",
        [id, Number(rest[0])],
      )
    ).rowCount;
  if (kind === "review-invitation")
    return !!(
      await c.query(
        "SELECT 1 FROM projects p WHERE p.id=$1 AND p.status='completed' AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.project_id=p.id)",
        [id],
      )
    ).rowCount;
  return true;
}
