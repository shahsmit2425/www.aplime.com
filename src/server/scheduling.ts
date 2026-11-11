import type pg from "pg";
import { withinWeeklyHours } from "../shared/preferences.js";
import { CALL_MINUTES } from "../shared/meetings.js";
import { fail } from "./errors.js";

// Appointments reserve a one-hour visit. Lock the professional so simultaneous
// confirmations across separate projects cannot double-book that visit.
export async function assertAppointment(
  c: pg.PoolClient,
  proId: string | null,
  value: string,
  projectId: string,
) {
  if (!proId)
    fail(409, "Choose a professional before proposing an appointment.");
  const profile = (
    await c.query(
      "SELECT weekly_hours,time_zone FROM profiles WHERE id=$1 FOR UPDATE",
      [proId],
    )
  ).rows[0];
  const project = (
    await c.query("SELECT customer_id FROM projects WHERE id=$1", [projectId])
  ).rows[0];
  if (project) {
    await c.query(
      "SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [[proId, project.customer_id]],
    );
    const calls = await c.query(
      "SELECT 1 FROM scheduled_calls WHERE status='confirmed' AND (pro_id=$1 OR customer_id=$2) AND starts_at < $3::timestamptz + interval '1 hour' AND starts_at + make_interval(mins => $4::int) > $3::timestamptz",
      [proId, project.customer_id, value, CALL_MINUTES],
    );
    if (calls.rowCount)
      fail(
        409,
        "That visit overlaps a confirmed call meeting. Choose another time.",
      );
  }
  const end = new Date(Date.parse(value) + 60 * 60000 - 1).toISOString();
  if (
    !profile ||
    !withinWeeklyHours(value, profile.weekly_hours, profile.time_zone) ||
    !withinWeeklyHours(end, profile.weekly_hours, profile.time_zone)
  )
    fail(
      409,
      "Choose a one-hour visit within the professional’s published hours.",
    );
  const conflict = await c.query(
    "SELECT 1 FROM projects WHERE (pro_id=$1 OR customer_id=$4) AND id<>$2 AND status IN ('booked','in_progress','paused','disputed') AND scheduled_at IS NOT NULL AND scheduled_at < $3::timestamptz + interval '1 hour' AND scheduled_at + interval '1 hour' > $3::timestamptz",
    [proId, projectId, value, project?.customer_id || ""],
  );
  if (conflict.rowCount)
    fail(
      409,
      "That visit overlaps another confirmed appointment. Please choose another time.",
    );
}
