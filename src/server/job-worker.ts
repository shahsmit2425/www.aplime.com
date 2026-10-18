import { PgBoss } from "pg-boss";
import { pool } from "./db/index.js";
import { cleanupDeletedAccounts, cleanupStorage } from "./account-cleanup.js";
import { sendEmail } from "./integrations/email.js";
import { deliverOutbox } from "./outbox.js";
import { expireEstimates } from "./estimates.js";
import { closeDueMeetings } from "./meeting-lifecycle.js";
import { queueEmailReminders } from "./email-reminders.js";
import { jobQueues, jobQueueOptions } from "./job-queue.js";
export async function startJobWorker() {
  const boss = new PgBoss({
    db: {
      executeSql: async (sql, values) => {
        const result = await pool.query(sql, values);
        // pg-boss schema maintenance reads rows from multiple statements in one query.
        return {
          rows: Array.isArray(result)
            ? result.flatMap((part) => part.rows)
            : result.rows,
        };
      },
    },
    schema: "pgboss",
    instanceName: "aplime-worker",
  });
  boss.on("error", () =>
    console.error(
      "Job queue operation failed; inspect worker and PostgreSQL health",
    ),
  );
  await boss.start();
  const handlers: Record<(typeof jobQueues)[number], () => Promise<unknown>> = {
    "email-delivery": () => deliverOutbox(sendEmail, 20),
    "email-reminders": queueEmailReminders,
    "meeting-lifecycle": closeDueMeetings,
    "estimate-expiry": expireEstimates,
    "storage-cleanup": cleanupStorage,
    "account-cleanup": cleanupDeletedAccounts,
  };
  for (const name of jobQueues) {
    await boss.createQueue(name, jobQueueOptions);
    await boss.work(name, async () => {
      try {
        await handlers[name]();
      } catch (error) {
        console.error("Background task failed: " + name);
        throw error;
      }
    });
    await boss.schedule(name, "* * * * *", {}, { singletonKey: name });
    await boss.send(name, {}, { singletonKey: name });
  }
  let enqueueing = false;
  const fast = setInterval(() => {
    if (enqueueing) return;
    enqueueing = true;
    void Promise.all(
      ["email-delivery", "meeting-lifecycle", "estimate-expiry"].map((name) =>
        boss.send(name, {}, { singletonKey: name }),
      ),
    )
      .catch(() => console.error("Fast job scheduling deferred"))
      .finally(() => {
        enqueueing = false;
      });
  }, 5000);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(fast);
    await boss.stop({ graceful: true, timeout: 25000 });
    await pool.end();
  };
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      void stop().catch(() => {
        process.exitCode = 1;
      });
    });
  console.log("pg-boss background worker ready: " + jobQueues.join(", "));
}
