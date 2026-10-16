import type pg from "pg";
import { randomUUID } from "node:crypto";
import { emailPolicy, type EmailTarget } from "../shared/email-alerts.js";

export async function queueEventEmails(
  c: Pick<pg.PoolClient, "query">,
  notices: { id: string; user_id: string }[],
  title: string,
  body: string,
  target: EmailTarget,
) {
  const policy = emailPolicy(title, target);
  if (policy.muted || !notices.length) return;
  if (policy.grouped) {
    for (const notice of notices) {
      // Serialize coalescing across API instances. Only an unclaimed batch can change.
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "email:" + notice.user_id + ":" + target.id,
      ]);
      const existing = await c.query(
        "UPDATE email_outbox SET notification_id=$3 WHERE user_id=$1 AND target_id=$2 AND category='messages' AND sent_at IS NULL AND cancelled_at IS NULL AND attempts=0 RETURNING id",
        [notice.user_id, target.id || "", notice.id],
      );
      if (existing.rowCount) continue;
      await insert([notice]);
    }
  } else await insert(notices);
  async function insert(batch: typeof notices) {
    await c.query(
      `INSERT INTO email_outbox(id,user_id,subject,body,category,essential,target_page,target_id,notification_id,next_attempt_at)
       SELECT gen_random_uuid(),u.id,$2,$3,$4,$5,$6,$7,n.id,
       CASE WHEN $4='messages' THEN GREATEST(now()+interval '2 minutes',COALESCE((SELECT max(old.sent_at)+interval '15 minutes' FROM email_outbox old WHERE old.user_id=u.id AND old.category='messages' AND old.target_id=$7),now())) ELSE now() END
       FROM jsonb_to_recordset($1::jsonb) AS n(id uuid,user_id text) JOIN users u ON u.id=n.user_id
       WHERE u.deleted_at IS NULL AND ($5 OR (COALESCE((u.settings->>'emailAlerts')::boolean,true) AND COALESCE((u.settings->'emailCategories'->>$4)::boolean,true)))`,
      [
        JSON.stringify(batch),
        title,
        body,
        policy.category,
        policy.essential,
        target.page,
        target.id || "",
      ],
    );
  }
}

export async function notifyOnce(
  c: Pick<pg.PoolClient, "query">,
  userId: string,
  key: string,
  title: string,
  body: string,
  target: EmailTarget,
) {
  const inserted = await c.query(
    "INSERT INTO alert_event_receipts(user_id,event_key) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id",
    [userId, key],
  );
  if (!inserted.rowCount) return;
  const id = randomUUID();
  await c.query(
    "INSERT INTO notifications(id,user_id,title,body,target_page,target_id) SELECT $1,id,$3,$4,$5,$6 FROM users WHERE id=$2 AND deleted_at IS NULL",
    [id, userId, title, body, target.page, target.id || null],
  );
  await queueEventEmails(c, [{ id, user_id: userId }], title, body, target);
  await c.query(
    "UPDATE email_outbox SET event_key=$2 WHERE notification_id=$1",
    [id, key],
  );
}
