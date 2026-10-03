import test from "node:test";
import assert from "node:assert/strict";
import { env, validateMailWorker } from "../src/server/config.js";
const config = {
  ...env,
  DATABASE_URL: "postgresql://localhost/test",
  SMTP_HOST: "smtp.office365.com",
  SMTP_PORT: 587,
  SMTP_USER: "mail@example.invalid",
  SMTP_FROM: "mail@example.invalid",
  MICROSOFT_TENANT_ID: "test-tenant",
  MICROSOFT_CLIENT_ID: "test-client",
  MICROSOFT_CLIENT_SECRET: "test-secret",
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
  for (const key of [
    "DATABASE_URL",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_FROM",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
  ] as const) {
    assert.throws(
      () => validateMailWorker({ ...config, [key]: " " }),
      new RegExp(key),
    );
  }
  for (const port of [0, 65536, 1.5])
    assert.throws(
      () => validateMailWorker({ ...config, SMTP_PORT: port }),
      /SMTP_PORT/,
    );
});
