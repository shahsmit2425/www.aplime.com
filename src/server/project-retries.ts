import type pg from "pg";
import { fail } from "./errors.js";
import { lockActiveAccount } from "./quotas.js";

// The account lock serializes retries with publishing, quotas and deletion.
export async function previousProjectRequest(
  c: Pick<pg.PoolClient, "query">,
  userId: string,
  clientKey: string | undefined,
  fingerprint: string,
): Promise<string | undefined> {
  await lockActiveAccount(c, userId);
  if (!clientKey) return;
  const row = (
    await c.query(
      "SELECT project_id,fingerprint FROM project_publish_requests WHERE user_id=$1 AND client_key=$2",
      [userId, clientKey],
    )
  ).rows[0];
  if (row && row.fingerprint !== fingerprint)
    fail(
      409,
      "This request was already submitted with different details. Start a new request.",
    );
  return row?.project_id;
}
