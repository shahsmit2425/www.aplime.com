import test from "node:test";
import assert from "node:assert/strict";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  recallToken,
  rememberToken,
  clearTokenCache,
  TOKEN_CACHE_TTL_MS,
} from "../src/server/token-cache.js";

const now = 1_000_000;
const token = (extra: Record<string, unknown> = {}, exp = now / 1000 + 3600) =>
  ({ uid: "u1", email: "a@b.co", exp, ...extra }) as unknown as DecodedIdToken;

test("a verified token is reused only for the short cache window", () => {
  clearTokenCache();
  rememberToken("t1", token(), now);
  assert.equal(recallToken("t1", now + TOKEN_CACHE_TTL_MS - 1)?.uid, "u1");
  assert.equal(recallToken("t1", now + TOKEN_CACHE_TTL_MS), undefined);
  assert.equal(recallToken("t1", now + 1), undefined);
});

test("administrator tokens are never cached so revocation applies immediately", () => {
  clearTokenCache();
  rememberToken("admin", token({ admin: true }), now);
  assert.equal(recallToken("admin", now), undefined);
});

test("cache entries never outlive the token itself and other tokens never match", () => {
  clearTokenCache();
  rememberToken("short", token({}, now / 1000 + 5), now);
  assert.equal(recallToken("short", now + 4000)?.uid, "u1");
  assert.equal(recallToken("short", now + 5000), undefined);
  rememberToken("expired", token({}, now / 1000 - 1), now);
  assert.equal(recallToken("expired", now), undefined);
  rememberToken("mine", token(), now);
  assert.equal(recallToken("someone-else", now), undefined);
});
