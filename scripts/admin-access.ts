import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../src/server/config.js";
import { pool, transaction } from "../src/server/db/index.js";
import { audit } from "../src/server/repository.js";
import { accessFailureRecord } from "./lib/admin-setup.js";
const [action, uid] = process.argv.slice(2);
if (!["grant", "revoke"].includes(action) || !uid)
  throw new Error("Usage: npm run admin:access -- grant|revoke FIREBASE_UID");
let stage: Parameters<typeof accessFailureRecord>[0] = "identity";
try {
  const auth = getAuth(
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    }),
  );
  const user = await auth.getUser(uid);
  stage = "policy";
  if (action === "grant") {
    if (!user.emailVerified || !user.email || user.disabled)
      throw new Error(
        "Create and verify a dedicated, enabled Firebase administrator account first.",
      );
    if (
      !env.ADMIN_ALLOWED_UIDS.split(",")
        .map((x) => x.trim())
        .includes(uid)
    )
      throw new Error(
        "Add this UID to ADMIN_ALLOWED_UIDS before granting access.",
      );
    stage = "database";
    const existing = await pool.query("SELECT role FROM users WHERE id=$1", [
      uid,
    ]);
    if (existing.rows[0] && existing.rows[0].role !== "admin") {
      stage = "policy";
      throw new Error(
        "Use a dedicated admin identity, not an existing customer/pro account.",
      );
    }
    await transaction(async (c) => {
      const granted = await c.query(
        "INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,'admin') ON CONFLICT(id) DO UPDATE SET role='admin' WHERE users.role='admin' RETURNING id",
        [uid, user.email, user.displayName || "Administrator"],
      );
      if (!granted.rowCount)
        throw new Error(
          "This identity became a marketplace account; use a dedicated administrator identity.",
        );
      await audit(c, uid, "admin_grant", uid);
    });
    stage = "claims";
    await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
  } else {
    // Removing the live claim and revoking tokens blocks access without deleting audit history.
    stage = "claims";
    await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: false });
    stage = "revocation";
    await auth.revokeRefreshTokens(uid);
    stage = "database";
    await transaction((c) => audit(c, uid, "admin_revoke", uid));
  }
  stage = "revocation";
  await auth.revokeRefreshTokens(uid);
  console.log(
    action === "grant"
      ? "Access provisioned. Enroll TOTP on the admin site, then sign in again."
      : "Access revoked. Remove the UID from ADMIN_ALLOWED_UIDS as well.",
  );
} catch (error) {
  console.error(
    "ADMIN_ACCESS_FAILURE " + JSON.stringify(accessFailureRecord(stage, error)),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
