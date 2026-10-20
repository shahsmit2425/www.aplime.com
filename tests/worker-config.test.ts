import test from "node:test";
import assert from "node:assert/strict";
import { env, validateMailWorker } from "../src/server/config.js";
const config = {
  ...env,
  DATABASE_URL: "postgresql://localhost/test",
  RESEND_API_KEY: "re_test_fixture",
  EMAIL_FROM: "mail@example.invalid",
  STRIPE_PRO_PRICE_ID: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  DAILY_API_KEY: "",
  FIREBASE_PRIVATE_KEY: "",
  R2_BUCKET: "",
  API_URL: "http://localhost:3001",
  SITE_URL: "http://localhost:5173",
};
test("mail worker starts with mail and database settings without unrelated providers", () => {
  assert.doesNotThrow(() => validateMailWorker(config));
});
test("mail worker still fails closed on missing mail/database configuration", () => {
  assert.throws(
    () => validateMailWorker({ ...config, NODE_ENV: "production" }),
    /SITE_URL/,
  );
  assert.doesNotThrow(() =>
    validateMailWorker({
      ...config,
      NODE_ENV: "production",
      SITE_URL: "https://example.invalid",
    }),
  );
  for (const key of ["DATABASE_URL", "RESEND_API_KEY", "EMAIL_FROM"] as const) {
    assert.throws(
      () => validateMailWorker({ ...config, [key]: " " }),
      new RegExp(key),
    );
  }
  for (const address of [
    "not-an-email",
    "Name <mail@example.invalid>",
    "mail@example.invalid\r\nBcc: other@example.invalid",
  ])
    assert.throws(
      () => validateMailWorker({ ...config, EMAIL_FROM: address }),
      /EMAIL_FROM/,
    );
  assert.throws(
    () => validateMailWorker({ ...config, RESEND_API_KEY: "invalid" }),
    /RESEND_API_KEY/,
  );
  assert.throws(
    () => validateMailWorker({ ...config, EMAIL_REPLY_TO: "invalid" }),
    /EMAIL_REPLY_TO/,
  );
  assert.doesNotThrow(() =>
    validateMailWorker({
      ...config,
      EMAIL_REPLY_TO: "support@example.invalid",
    }),
  );
});
