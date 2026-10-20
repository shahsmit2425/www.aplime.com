import { pool, transaction } from "./db/index.js";
import { emailAllowed, emailPolicy } from "../shared/email-alerts.js";
import { eventEmail } from "./email-template.js";
import { env } from "./config.js";
import { reminderStillRelevant } from "./email-reminders.js";
import { EmailDeliveryError } from "./integrations/email.js";

type Send = (
  to: string,
  subject: string,
  body: string,
  html?: string,
  messageId?: string,
) => Promise<unknown>;

// Claims a batch with a short lease, then sends outside the transaction so a slow provider never holds row locks
// The stable Message-ID also derives Resend's 24-hour idempotency key.
// Beyond that retention window, provider acceptance before a crash can still duplicate mail.
export async function deliverOutbox(send: Send, batch = 20) {
  await pool.query(
    "UPDATE email_outbox SET recipient_email=NULL,cancelled_at=COALESCE(cancelled_at,now()) WHERE recipient_email IS NOT NULL AND created_at<now()-interval '7 days' AND sent_at IS NULL",
  );
  const mails = await transaction(
    async (c) =>
      (
        await c.query(
          `UPDATE email_outbox o SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
           FROM (SELECT o2.id FROM email_outbox o2 WHERE o2.sent_at IS NULL AND o2.cancelled_at IS NULL AND o2.attempts<8 AND o2.next_attempt_at<=now()
                 ORDER BY o2.created_at LIMIT $1 FOR UPDATE SKIP LOCKED) due
           WHERE o.id=due.id
           RETURNING o.*`,
          [batch],
        )
      ).rows,
  );
  for (const mail of mails) {
    try {
      const user = (
        await pool.query(
          "SELECT email,role,settings,deleted_at FROM users WHERE id=$1",
          [mail.user_id],
        )
      ).rows[0];
      const target = {
        page: mail.target_page || "dashboard",
        id: mail.target_id || undefined,
      };
      const policy = emailPolicy(mail.subject, target);
      if (!mail.target_page)
        target.page = (
          {
            meetings: "schedule",
            business: "profile",
            billing: "subscription",
            security: "settings",
            reviews: "reviews",
            support: "messages",
            messages: "messages",
            projects: "dashboard",
          } as const
        )[policy.category];
      const deletionNotice =
        mail.subject === "Account deleted" &&
        mail.essential &&
        !!mail.recipient_email;
      const category = mail.category || policy.category;
      const essential = mail.essential || policy.essential;
      const disabled =
        !essential &&
        (
          await pool.query(
            "SELECT enabled FROM email_category_settings WHERE category=$1",
            [category],
          )
        ).rows[0]?.enabled === false;
      const read =
        mail.notification_id &&
        policy.grouped &&
        (
          await pool.query("SELECT read FROM notifications WHERE id=$1", [
            mail.notification_id,
          ])
        ).rows[0]?.read;
      const blocked =
        policy.grouped &&
        mail.target_id &&
        /^[0-9a-f-]{36}$/i.test(mail.target_id) &&
        (
          await pool.query(
            "SELECT 1 FROM project_discussions d JOIN projects p ON p.id=d.project_id JOIN profiles f ON f.id=d.pro_id WHERE d.id=$1 AND (f.suspended OR EXISTS(SELECT 1 FROM blocked b WHERE (b.user_id=p.customer_id AND b.other_id=d.pro_id) OR (b.user_id=d.pro_id AND b.other_id=p.customer_id)))",
            [mail.target_id],
          )
        ).rowCount;
      if (
        !user ||
        (user.deleted_at && !deletionNotice) ||
        policy.muted ||
        read ||
        blocked ||
        disabled ||
        !emailAllowed(user.settings, category, essential) ||
        !(await reminderStillRelevant(mail.event_key, pool))
      ) {
        await pool.query(
          "UPDATE email_outbox SET cancelled_at=now(),recipient_email=NULL WHERE id=$1",
          [mail.id],
        );
        continue;
      }
      const template = eventEmail(mail.subject, mail.body, target, user.role);
      await send(
        deletionNotice ? mail.recipient_email : user.email,
        mail.subject,
        template.text,
        template.html,
        `<aplime.${mail.id}@${new URL(env.SITE_URL).hostname}>`,
      );
      await pool.query(
        "UPDATE email_outbox SET sent_at=now(),recipient_email=NULL WHERE id=$1",
        [mail.id],
      );
    } catch (error) {
      await pool.query(
        "UPDATE email_outbox SET next_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(2,attempts-1)::int)) WHERE id=$1",
        [mail.id],
      );
      console.error(
        "Email delivery deferred",
        mail.id,
        error instanceof EmailDeliveryError
          ? { provider: "resend", code: error.code, status: error.status }
          : { code: "processing_error" },
      );
      if (mail.attempts === 8)
        await pool.query(
          "INSERT INTO notifications(id,user_id,title,body,target_page) SELECT gen_random_uuid(),id,'Email delivery failed','An email exhausted its retry attempts. Review failed deliveries in Email & alerts.','emails' FROM users WHERE role='admin' AND deleted_at IS NULL",
        );
    }
  }
  return mails.length;
}
