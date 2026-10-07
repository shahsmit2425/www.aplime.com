import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { spawnSync } from "node:child_process";
import { env } from "../src/server/config.js";
import { pool } from "../src/server/db/index.js";
import {
  AdminSetupError,
  setupAdministrator,
  setupArguments,
} from "./lib/admin-setup.js";

// Operator-only tool. Never import into an HTTP route or frontend bundle.
try {
  const options = setupArguments(process.argv.slice(2));
  for (const key of [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "DATABASE_URL",
  ] as const)
    if (!env[key])
      throw new AdminSetupError(
        "Missing " + key + ". Run this from the configured API service Shell.",
      );
  console.log(
    "Admin setup environment: " +
      env.APP_ENV +
      "; Firebase project: " +
      env.FIREBASE_PROJECT_ID,
  );
  const auth = getAuth(
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    }),
  );
  await setupAdministrator(options, {
    auth,
    allowedUids: env.ADMIN_ALLOWED_UIDS.split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
    findRole: async (uid) =>
      (await pool.query("SELECT role FROM users WHERE id=$1", [uid])).rows[0]
        ?.role || null,
    grant: async (user) => {
      // Reuse the existing audited provisioner, which rechecks UID/email/database role.
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "scripts/admin-access.ts", "grant", user.uid],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      if (result.error || result.status !== 0)
        throw new AdminSetupError(
          "Provisioning did not complete. No success is claimed. Recheck account verification, owner-approved UID, service-account permissions and database migrations. Run admin:setup -- EMAIL --check before retrying.",
        );
    },
    report: console.log,
  });
} catch (error) {
  if (error instanceof AdminSetupError) console.error(error.message);
  else {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    console.error(
      code === "auth/user-not-found"
        ? "That email was not found in this API's Firebase project. Create a dedicated Email/Password account in Firebase Authentication and retry."
        : "Admin setup could not complete. Check this API's Firebase project/service account, Identity Platform activation, project-config permissions and database connection. No successful provisioning is claimed.",
    );
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
