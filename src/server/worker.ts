import { pool, transaction } from "./db/index.js";
import { sendEmail } from "./integrations/email.js";
import { env, validateMailWorker } from "./config.js";
if (env.NODE_ENV === "production") validateMailWorker();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
  });
while (!stopping) {
  try {
    await transaction(async (c) => {
      const { rows } = await c.query(
        "SELECT o.*,u.email FROM email_outbox o JOIN users u ON u.id=o.user_id WHERE sent_at IS NULL AND attempts<8 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE OF o SKIP LOCKED LIMIT 1",
      );
      const mail = rows[0];
      if (!mail) return;
      try {
        await sendEmail(mail.email, mail.subject, mail.body);
        await c.query(
          "UPDATE email_outbox SET sent_at=now(),attempts=attempts+1 WHERE id=$1",
          [mail.id],
        );
      } catch {
        await c.query(
          "UPDATE email_outbox SET attempts=attempts+1,next_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(2,attempts)::int)) WHERE id=$1",
          [mail.id],
        );
        console.error("Email delivery deferred", mail.id);
      }
    });
  } catch {
    console.error("Email worker could not reach the database.");
  }
  await new Promise((r) => setTimeout(r, 3000));
}
await pool.end();
