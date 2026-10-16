import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "../config.js";
import { requireValue, fail } from "../errors.js";
import { recallToken, rememberToken } from "../token-cache.js";
function firebaseApp() {
  requireValue(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY,
    "Sign-in is not configured yet.",
  );
  return (
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    })
  );
}
export async function deleteFirebaseUser(uid: string) {
  try {
    await getAuth(firebaseApp()).deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return;
    throw e;
  }
}
export async function verifyToken(token: string): Promise<DecodedIdToken> {
  const recent = recallToken(token);
  if (recent) return recent;
  const app = firebaseApp();
  try {
    const decoded = await getAuth(app).verifyIdToken(token, true);
    if (!decoded.email || !decoded.email_verified)
      fail(403, "Verify your email before continuing.");
    rememberToken(token, decoded);
    return decoded;
  } catch (e) {
    if ((e as { status?: number }).status) throw e;
    fail(401, "Please sign in again.");
  }
}

export async function revokeUserSessions(uid: string) {
  await getAuth(firebaseApp()).revokeRefreshTokens(uid);
}
