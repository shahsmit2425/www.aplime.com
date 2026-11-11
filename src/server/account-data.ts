import type pg from "pg";
import { pool, transaction } from "./db/index.js";
import { fail } from "./errors.js";
import { audit, notify } from "./repository.js";
import { recordProjectActivity } from "./project-events.js";
import { stripe } from "./integrations/stripe.js";
import { removeObject } from "./integrations/storage.js";

const EXPORT_ROW_LIMIT = 5000;
export const REAUTH_WINDOW_SECONDS = 300;
const ACTIVE_STATUSES = ["booked", "in_progress", "paused", "disputed"];
const LIVE_SUBSCRIPTIONS = ["active", "trialing", "past_due", "unpaid"];

export function assertRecentSignIn(authTime: number | undefined) {
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(authTime) ||
    (authTime as number) > now + 60 ||
    now - (authTime as number) > REAUTH_WINDOW_SECONDS
  )
    fail(401, "Confirm your password or sign-in provider again to continue.");
}

const rows = async (sql: string, values: unknown[]) => {
  const result = (
    await pool.query(sql + " LIMIT " + (EXPORT_ROW_LIMIT + 1), values)
  ).rows;
  if (result.length > EXPORT_ROW_LIMIT)
    fail(
      409,
      "Your account needs a larger export. Contact support for a complete copy; no partial download was generated.",
    );
  return result;
};

export async function exportAccountData(userId: string) {
  const user = (
    await pool.query(
      "SELECT id,email,name,role,settings,created_at FROM users WHERE id=$1 AND deleted_at IS NULL",
      [userId],
    )
  ).rows[0];
  if (!user) fail(404, "Account not found.");
  const profile = (
    await pool.query(
      "SELECT to_jsonb(p)-'stripe_account_id'-'identity_session_id'-'published_profile' AS profile FROM profiles p WHERE id=$1",
      [userId],
    )
  ).rows[0]?.profile;
  const projects = await rows(
    "SELECT * FROM projects WHERE customer_id=$1 OR pro_id=$1 ORDER BY created_at DESC",
    [userId],
  );
  const projectIds = projects.map((p) => p.id);
  const byProject = (table: string, extra = "") =>
    rows(
      `SELECT * FROM ${table} WHERE project_id=ANY($1::uuid[]) ${extra} ORDER BY created_at DESC`,
      [projectIds],
    );
  return {
    exportedAt: new Date().toISOString(),
    notice:
      "This file contains the personal data Aplime holds for your account. Messages are limited to those you sent. Payment card details are held by Stripe and are not included.",
    account: user,
    businessProfile: profile || null,
    businessImages: await rows(
      "SELECT id,slot,name,content_type,size,status,created_at FROM business_images WHERE profile_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
    membership: (
      await pool.query(
        "SELECT status,cancel_at_period_end,updated_at FROM professional_subscriptions WHERE user_id=$1",
        [userId],
      )
    ).rows[0],
    projects,
    projectContacts: await rows(
      "SELECT c.project_id,c.phone,c.consent_at,c.consent_version FROM project_contacts c JOIN projects p ON p.id=c.project_id WHERE p.customer_id=$1 ORDER BY c.consent_at DESC",
      [userId],
    ),
    reviewPhotos: await rows(
      "SELECT i.project_id,i.slot,i.created_at FROM review_images i JOIN projects p ON p.id=i.project_id WHERE p.customer_id=$1 ORDER BY i.created_at DESC",
      [userId],
    ),
    projectFiles: await rows(
      "SELECT id,project_id,name,content_type,size,status,created_at FROM uploads WHERE user_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
    quotes: await rows(
      "SELECT q.* FROM quotes q WHERE q.pro_id=$1 OR q.project_id IN (SELECT id FROM projects WHERE customer_id=$1) ORDER BY q.created_at DESC",
      [userId],
    ),
    reviews: await byProject("reviews"),
    payments: await byProject("payments"),
    projectActivity: await byProject("project_activity"),
    scheduledCalls: await rows(
      "SELECT * FROM scheduled_calls WHERE customer_id=$1 OR pro_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
    messagesSent: {
      projectMessages: await rows(
        "SELECT id,project_id,body,created_at FROM messages WHERE sender_id=$1 ORDER BY created_at DESC",
        [userId],
      ),
      discussionMessages: await rows(
        "SELECT id,discussion_id,body,created_at FROM discussion_messages WHERE sender_id=$1 ORDER BY created_at DESC",
        [userId],
      ),
      supportMessages: await rows(
        "SELECT id,ticket_id,body,created_at FROM support_messages WHERE sender_id=$1 ORDER BY created_at DESC",
        [userId],
      ),
    },
    supportRequests: await rows(
      "SELECT id,project_id,subject,body,status,resolution,created_at FROM tickets WHERE user_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
    notifications: await rows(
      "SELECT id,title,body,read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
    savedProfessionals: await rows(
      "SELECT pro_id FROM saved WHERE user_id=$1",
      [userId],
    ),
    blockedAccounts: await rows(
      "SELECT other_id FROM blocked WHERE user_id=$1",
      [userId],
    ),
    projectDraft: (
      await pool.query(
        "SELECT payload,updated_at FROM project_drafts WHERE user_id=$1",
        [userId],
      )
    ).rows[0],
  };
}

async function closeOpenCustomerProjects(c: pg.PoolClient, userId: string) {
  const open = (
    await c.query(
      "SELECT id,title FROM projects WHERE customer_id=$1 AND status IN ('requested','quoted') FOR UPDATE",
      [userId],
    )
  ).rows;
  for (const p of open) {
    const quoters = (
      await c.query(
        "SELECT pro_id FROM quotes WHERE project_id=$1 AND status='pending'",
        [p.id],
      )
    ).rows;
    await c.query(
      "UPDATE projects SET status='cancelled',scheduled_at=NULL,proposed_at=NULL,proposed_by=NULL,version=version+1 WHERE id=$1",
      [p.id],
    );
    await c.query(
      "UPDATE quotes SET status='declined' WHERE project_id=$1 AND status='pending'",
      [p.id],
    );
    await recordProjectActivity(
      c,
      p.id,
      userId,
      "account_deleted",
      "Project closed because the customer deleted their account",
    );
    for (const q of quoters)
      await notify(
        c,
        q.pro_id,
        "Project cancelled",
        p.title + ": the customer closed their account.",
        { page: "project", id: p.id },
      );
  }
}

export async function deleteAccountData(userId: string) {
  const keys = await transaction(async (c) => {
    const user = (
      await c.query(
        "SELECT id,email,role,deleted_at FROM users WHERE id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (!user || user.deleted_at) fail(404, "Account not found.");
    if (user.role === "admin")
      fail(403, "Administrator access must be removed by an operator.");
    const active = Number(
      (
        await c.query(
          `SELECT count(*) FROM projects WHERE (customer_id=$1 AND status=ANY($2)) OR (pro_id=$1 AND status NOT IN ('completed','cancelled'))`,
          [userId, ACTIVE_STATUSES],
        )
      ).rows[0].count,
    );
    if (active)
      fail(
        409,
        `Finish, cancel or resolve your ${active} active project${active === 1 ? "" : "s"} before deleting your account.`,
      );
    const membership = (
      await c.query(
        "SELECT * FROM professional_subscriptions WHERE user_id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (
      membership &&
      LIVE_SUBSCRIPTIONS.includes(membership.status) &&
      !membership.cancel_at_period_end
    )
      fail(409, "Cancel your membership before deleting your account.");

    // The same membership row serializes checkout creation and account deletion.
    // A completed checkout may precede its webhook; never delete in that gap.
    if (membership?.checkout_id) {
      const checkout = await stripe().checkout.sessions.retrieve(
        membership.checkout_id,
      );
      if (checkout.status === "complete") {
        if (!membership.subscription_id)
          fail(
            409,
            "Your checkout is processing. Wait for billing confirmation before deleting your account.",
          );
      } else if (checkout.status === "open") {
        try {
          await stripe().checkout.sessions.expire(checkout.id);
        } catch {
          fail(
            409,
            "Checkout could not be closed. Refresh billing and retry deletion.",
          );
        }
      }
    }
    if (membership?.subscription_id) {
      const current = await stripe().subscriptions.retrieve(
        membership.subscription_id,
      );
      if (
        !["canceled", "incomplete_expired"].includes(current.status) &&
        !current.cancel_at_period_end
      )
        fail(409, "Cancel your membership before deleting your account.");
    }
    await closeOpenCustomerProjects(c, userId);
    await c.query(
      "UPDATE quotes SET status='withdrawn' WHERE pro_id=$1 AND status='pending'",
      [userId],
    );
    const keys = [
      ...(
        await c.query("SELECT object_key FROM uploads WHERE user_id=$1", [
          userId,
        ])
      ).rows,
      ...(
        await c.query(
          "SELECT object_key FROM business_images WHERE profile_id=$1",
          [userId],
        )
      ).rows,
      ...(
        await c.query(
          "SELECT i.object_key FROM review_images i JOIN projects p ON p.id=i.project_id WHERE p.customer_id=$1",
          [userId],
        )
      ).rows,
    ].map((r) => String(r.object_key));
    const published = (
      await c.query("SELECT published_profile FROM profiles WHERE id=$1", [
        userId,
      ])
    ).rows[0]?.published_profile;
    for (const image of published?.images || []) keys.push(image.key);
    await c.query(
      "DELETE FROM review_images i USING projects p WHERE i.project_id=p.id AND p.customer_id=$1",
      [userId],
    );
    await c.query(
      "DELETE FROM project_contacts c USING projects p WHERE c.project_id=p.id AND p.customer_id=$1",
      [userId],
    );
    await c.query("DELETE FROM uploads WHERE user_id=$1", [userId]);
    await c.query("DELETE FROM business_images WHERE profile_id=$1", [userId]);
    await c.query("DELETE FROM project_drafts WHERE user_id=$1", [userId]);
    await c.query("DELETE FROM project_archives WHERE user_id=$1", [userId]);
    await c.query("DELETE FROM notifications WHERE user_id=$1", [userId]);
    await c.query("DELETE FROM email_outbox WHERE user_id=$1", [userId]);
    await c.query("DELETE FROM saved WHERE user_id=$1 OR pro_id=$1", [userId]);
    await c.query("DELETE FROM blocked WHERE user_id=$1 OR other_id=$1", [
      userId,
    ]);
    await c.query(
      "UPDATE profiles SET published_profile=NULL,business='Deleted business',bio='',zip='',address='',place_id='',town='',region='',details='{}',latitude=NULL,longitude=NULL,listed=false,available=false,verified=false,review_status='draft',review_note=NULL,submitted_at=NULL,reviewed_at=NULL,reviewed_by=NULL,service_categories='[]',weekly_hours='{}',availability='[]' WHERE id=$1",
      [userId],
    );
    await c.query(
      "UPDATE users SET email='deleted-'||id||'@deleted.invalid',name='Deleted user',settings='{}',deleted_at=now() WHERE id=$1",
      [userId],
    );
    await c.query(
      "INSERT INTO account_cleanup_jobs(user_id,object_keys) VALUES($1,$2)",
      [userId, JSON.stringify(keys)],
    );
    await audit(c, userId, "account_deleted", userId);
    await c.query(
      "INSERT INTO email_outbox(id,user_id,subject,body,category,essential,recipient_email,target_page) VALUES(gen_random_uuid(),$1,'Account deleted','Your Aplime account has been deleted. Shared records needed by other participants or for support are retained under our retention policy.','security',true,$2,'settings')",
      [userId, user.email],
    );
    return keys;
  });
  await Promise.all(
    keys.map((key) =>
      removeObject(key).catch(() => {
        console.error("Deleted-account file cleanup failed");
      }),
    ),
  );
}
