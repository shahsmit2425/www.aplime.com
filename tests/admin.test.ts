import test from "node:test";
import assert from "node:assert/strict";
import type { DecodedIdToken } from "firebase-admin/auth";
import { assertAdmin } from "../src/server/admin-policy.js";
import type { User } from "../src/shared/domain.js";
const now = 1900000000;
const account: User = {
  id: "approved",
  role: "admin",
  email: "admin@example.invalid",
  name: "Admin",
  settings: {},
};
const token = {
  uid: "approved",
  admin: true,
  auth_time: now - 10,
  firebase: { sign_in_second_factor: "totp" },
} as unknown as DecodedIdToken;
test("administrator access requires every independent authorization condition", () => {
  assert.doesNotThrow(() => assertAdmin(token, account, ["approved"], now));
  for (const role of ["customer", "pro"] as const)
    assert.throws(() =>
      assertAdmin(token, { ...account, role }, ["approved"], now),
    );
  assert.throws(() => assertAdmin(token, undefined, ["approved"], now));
  assert.throws(() =>
    assertAdmin(token, { ...account, id: "other" }, ["approved"], now),
  );
  assert.throws(() =>
    assertAdmin({ ...token, admin: false }, account, ["approved"], now),
  );
  assert.throws(() =>
    assertAdmin({ ...token, admin: "true" }, account, ["approved"], now),
  );
  assert.throws(() => assertAdmin(token, account, [], now));
  assert.throws(() => assertAdmin(token, account, ["another-admin"], now));
});
test("admin tokens without TOTP or with stale authentication fail closed", () => {
  for (const second of [undefined, "phone"])
    assert.throws(() =>
      assertAdmin(
        {
          ...token,
          firebase: { ...token.firebase, sign_in_second_factor: second },
        },
        account,
        ["approved"],
        now,
      ),
    );
  for (const auth_time of [now - 3601, now + 61, NaN, undefined])
    assert.throws(() =>
      assertAdmin(
        { ...token, auth_time } as DecodedIdToken,
        account,
        ["approved"],
        now,
      ),
    );
});
