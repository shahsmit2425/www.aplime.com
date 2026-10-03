import test from "node:test";
import assert from "node:assert/strict";
import { createOrResume } from "../src/client/registration.js";

test("repeat registration authenticates once and returns the existing account directly", async () => {
  let attempts = 0;
  const user = { emailVerified: false };
  const result = await createOrResume(
    async () => { throw { code: "auth/email-already-in-use" }; },
    async () => { attempts++; return user; },
  );
  assert.equal(result.credential, user);
  assert.equal(result.created, false);
  assert.equal(attempts, 1);
});

test("wrong password never grants access to an existing account", async () => {
  await assert.rejects(createOrResume(
    async () => { throw { code: "auth/email-already-in-use" }; },
    async () => { throw new Error("invalid credential"); },
  ), /invalid credential/);
});

test("new registration and network errors do not trigger a second authentication attempt", async () => {
  const unexpected = async () => { throw new Error("unexpected sign-in"); };
  assert.equal((await createOrResume(async () => "new", unexpected)).created, true);
  await assert.rejects(createOrResume(async () => { throw new Error("network"); }, unexpected), /network/);
});
