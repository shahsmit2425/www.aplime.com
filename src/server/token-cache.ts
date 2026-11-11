import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";

// Firebase revocation checking is a network call per request. A verified token
// is remembered briefly so bursts of calls skip it; revocation therefore takes
// effect within TTL_MS. Tokens carrying the admin claim are never remembered.
export const TOKEN_CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 5000;
const verified = new Map<string, { decoded: DecodedIdToken; until: number }>();
const keyOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function recallToken(token: string, now = Date.now()) {
  const key = keyOf(token),
    hit = verified.get(key);
  if (!hit) return undefined;
  if (hit.until <= now) {
    verified.delete(key);
    return undefined;
  }
  return hit.decoded;
}
export function rememberToken(
  token: string,
  decoded: DecodedIdToken,
  now = Date.now(),
) {
  if (decoded.admin === true) return;
  const until = Math.min(now + TOKEN_CACHE_TTL_MS, decoded.exp * 1000);
  if (until <= now) return;
  if (verified.size >= MAX_ENTRIES) {
    for (const [key, value] of verified)
      if (value.until <= now) verified.delete(key);
    if (verified.size >= MAX_ENTRIES) verified.clear();
  }
  verified.set(keyOf(token), { decoded, until });
}
export function clearTokenCache() {
  verified.clear();
}
