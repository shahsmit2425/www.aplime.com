import type { DecodedIdToken } from "firebase-admin/auth";
import type { User } from "../shared/domain.js";
import { fail } from "./errors.js";

// This policy runs after signature, expiry, revocation and email verification.
export function assertAdmin(
  identity: DecodedIdToken,
  account: User | undefined,
  allowed: string[],
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !account ||
    account.id !== identity.uid ||
    account.role !== "admin" ||
    identity.admin !== true ||
    !allowed.includes(identity.uid)
  )
    fail(403, "Administrator access is not authorized.");
  if (identity.firebase?.sign_in_second_factor !== "totp")
    fail(403, "Sign in with your administrator authenticator code.");
  if (
    !Number.isFinite(identity.auth_time) ||
    identity.auth_time > now + 60 ||
    now - identity.auth_time > 3600
  )
    fail(401, "Administrator session expired. Sign in again.");
}
