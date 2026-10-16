import { cleanupDeletedAccounts, cleanupStorage } from "./account-cleanup.js";
import { pool } from "./db/index.js";
import { sendEmail } from "./integrations/email.js";
import { env, validateMailWorker } from "./config.js";
import { deliverOutbox } from "./outbox.js";
import { expireEstimates } from "./estimates.js";
import { closeDueMeetings } from "./meeting-lifecycle.js";
import { queueEmailReminders } from "./email-reminders.js";
if (env.NODE_ENV === "production") validateMailWorker();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
  });
const batch = 20;
let remindersAt = 0;
while (!stopping) {
  try {
    await cleanupStorage();
    await cleanupDeletedAccounts();
    await expireEstimates();
    await closeDueMeetings();
    if (Date.now() >= remindersAt) {
      await queueEmailReminders();
      remindersAt = Date.now() + 60000;
    }
    while (!stopping && (await deliverOutbox(sendEmail, batch)) === batch);
  } catch {
    console.error("Background worker could not reach the database.");
  }
  await new Promise((r) => setTimeout(r, 3000));
}
await pool.end();
