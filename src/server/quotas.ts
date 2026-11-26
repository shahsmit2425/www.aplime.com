import type pg from "pg";
import { fail } from "./errors.js";
import { platformSettings, settingDefaults } from "./platform-settings.js";

export async function lockActiveAccount(
  c: Pick<pg.PoolClient, "query">,
  userId: string,
) {
  const found = await c.query(
    "SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
    [userId],
  );
  if (!found.rowCount) fail(403, "This account is no longer available.");
}

type Db = Pick<pg.PoolClient, "query">;

// Soft per-account abuse limits. Each one fans out notifications and emails to
// other people, so they are bounded independently of the per-request rate limit.
// These are the defaults; administrators can change the live values.
export const QUOTAS = {
  projectsPerDay: settingDefaults.projectsPerDay,
  messagesPerMinute: settingDefaults.messagesPerMinute,
  messagesPerDay: settingDefaults.messagesPerDay,
  supportRequestsPerDay: settingDefaults.supportRequestsPerDay,
  supportRepliesPerHour: settingDefaults.supportRepliesPerHour,
} as const;

export async function assertProjectQuota(c: Db, customerId: string) {
  await lockActiveAccount(c, customerId);
  const { n } = (
    await c.query(
      "SELECT count(*)::int AS n FROM projects WHERE customer_id=$1 AND created_at > now() - interval '24 hours'",
      [customerId],
    )
  ).rows[0];
  if (n >= (await platformSettings(c)).projectsPerDay)
    fail(
      429,
      "You have reached today's limit for new projects. Please try again tomorrow or contact support.",
    );
}
export async function assertMessageQuota(c: Db, senderId: string) {
  await lockActiveAccount(c, senderId);
  const row = (
    await c.query(
      "SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS minute, count(*)::int AS day FROM discussion_messages WHERE sender_id=$1 AND created_at > now() - interval '24 hours'",
      [senderId],
    )
  ).rows[0];
  const limits = await platformSettings(c);
  if (row.minute >= limits.messagesPerMinute)
    fail(429, "You are sending messages too quickly. Wait a moment.");
  if (row.day >= limits.messagesPerDay)
    fail(429, "You have reached today's message limit. Try again tomorrow.");
}
export async function assertSupportRequestQuota(c: Db, userId: string) {
  await lockActiveAccount(c, userId);
  const { n } = (
    await c.query(
      "SELECT count(*)::int AS n FROM tickets WHERE user_id=$1 AND (opened_by IS NULL OR opened_by=$1) AND created_at > now() - interval '24 hours'",
      [userId],
    )
  ).rows[0];
  if (n >= (await platformSettings(c)).supportRequestsPerDay)
    fail(
      429,
      "You have opened several support requests today. Reply in an existing conversation or try again tomorrow.",
    );
}
export async function assertSupportReplyQuota(c: Db, senderId: string) {
  await lockActiveAccount(c, senderId);
  const { n } = (
    await c.query(
      "SELECT count(*)::int AS n FROM support_messages WHERE sender_id=$1 AND created_at > now() - interval '1 hour'",
      [senderId],
    )
  ).rows[0];
  if (n >= (await platformSettings(c)).supportRepliesPerHour)
    fail(429, "You are sending support messages too quickly. Wait a while.");
}
