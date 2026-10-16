import { pool, transaction } from "./db/index.js";
import { removeObject } from "./integrations/storage.js";
import { deleteFirebaseUser } from "./integrations/firebase.js";
import { notifyAdministrators } from "./repository.js";
export async function cleanupDeletedAccounts() {
  const jobs = await transaction(
    async (c) =>
      (
        await c.query(
          `UPDATE account_cleanup_jobs j SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' FROM (SELECT user_id FROM account_cleanup_jobs WHERE completed_at IS NULL AND attempts<8 AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 5 FOR UPDATE SKIP LOCKED) due WHERE j.user_id=due.user_id RETURNING j.*`,
        )
      ).rows,
  );
  for (const job of jobs) {
    try {
      await deleteFirebaseUser(job.user_id);
      for (const key of job.object_keys) await removeObject(key);
      await pool.query(
        "UPDATE account_cleanup_jobs SET completed_at=now(),object_keys='[]' WHERE user_id=$1",
        [job.user_id],
      );
    } catch {
      await pool.query(
        "UPDATE account_cleanup_jobs SET next_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(2,attempts-1)::int)) WHERE user_id=$1",
        [job.user_id],
      );
      if (job.attempts === 8)
        await transaction((c) =>
          notifyAdministrators(
            c,
            "Account cleanup needs attention",
            "A deleted account has unfinished provider cleanup. An operator must retry the cleanup job.",
          ),
        );
    }
  }
}

export async function cleanupStorage() {
  const jobs = await transaction(
    async (c) =>
      (
        await c.query(
          `UPDATE storage_cleanup_jobs j SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' FROM (SELECT object_key FROM storage_cleanup_jobs WHERE attempts<8 AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 10 FOR UPDATE SKIP LOCKED) due WHERE j.object_key=due.object_key RETURNING j.*`,
        )
      ).rows,
  );
  for (const job of jobs) {
    try {
      await removeObject(job.object_key);
      await pool.query("DELETE FROM storage_cleanup_jobs WHERE object_key=$1", [
        job.object_key,
      ]);
    } catch {
      console.error("Storage cleanup deferred");
      if (job.attempts === 8)
        await transaction((c) =>
          notifyAdministrators(
            c,
            "Storage cleanup needs attention",
            "A retired business image could not be removed after repeated attempts. An operator must retry the storage cleanup job.",
          ),
        );
    }
  }
}
