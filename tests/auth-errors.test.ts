import test from "node:test";
import assert from "node:assert/strict";
import { authErrorCode, authErrorMessage } from "../src/client/auth.js";

test("existing Firebase accounts can be routed into the sign-in recovery flow", () => {
  assert.equal(
    authErrorCode({ code: "auth/email-already-in-use" }),
    "auth/email-already-in-use",
  );
});

test("authentication failures use clear instructions instead of provider errors", () => {
  assert.equal(
    authErrorMessage({ code: "auth/invalid-credential" }),
    "The email or password is incorrect. Try again or reset your password.",
  );
  assert.match(
    authErrorMessage({ code: "auth/too-many-requests" }),
    /Wait a few minutes/,
  );
});
