import { pool, transaction } from "./db/index.js";

type Send = (to: string, subject: string, body: string) => Promise<unknown>;

// Claims a batch with a short lease, then sends outside the transaction so a slow provider never holds row locks
// and a failed commit cannot trigger duplicate sends. A crash mid-send retries after the lease lapses.
export async function deliverOutbox(send: Send, batch = 20) {
  const mails = await transaction(
    async (c) =>
      (
        await c.query(
          `UPDATE email_outbox o SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
           FROM (SELECT o2.id FROM email_outbox o2 WHERE o2.sent_at IS NULL AND o2.attempts<8 AND o2.next_attempt_at<=now()
                 ORDER BY o2.created_at LIMIT $1 FOR UPDATE SKIP LOCKED) due
           WHERE o.id=due.id
           RETURNING o.id,o.user_id,o.subject,o.body,o.attempts,(SELECT email FROM users WHERE id=o.user_id) AS email`,
          [batch],
        )
      ).rows,
  );
  for (const mail of mails) {
    try {
      await send(mail.email, mail.subject, mail.body);
      await pool.query("UPDATE email_outbox SET sent_at=now() WHERE id=$1", [
        mail.id,
      ]);
    } catch {
      await pool.query(
        "UPDATE email_outbox SET next_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(2,attempts-1)::int)) WHERE id=$1",
        [mail.id],
      );
      console.error("Email delivery deferred", mail.id);
    }
  }
  return mails.length;
}
