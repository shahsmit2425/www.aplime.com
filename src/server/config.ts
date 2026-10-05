import "dotenv/config";
import { z } from "zod";
import type { PublicConfig } from "../shared/config.js";
const envSchema = z.object({
  API_URL: z.string().default("http://127.0.0.1:3001"),
  ADMIN_ALLOWED_UIDS: z.string().default(""),
  APP_ENV: z
    .enum(["development", "stagging", "production"])
    .default("development"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  SITE_URL: z.string().url().default("http://127.0.0.1:5173"),
  DATABASE_URL: z.string().default(""),
  DATABASE_SSL: z
    .enum(["require", "render-internal", "disable"])
    .default("require"),
  DATABASE_CA_CERT: z.string().default(""),
  FIREBASE_PROJECT_ID: z.string().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().default(""),
  FIREBASE_PRIVATE_KEY: z.string().default(""),
  FIREBASE_WEB_API_KEY: z.string().default(""),
  FIREBASE_AUTH_DOMAIN: z.string().default(""),
  FIREBASE_APP_ID: z.string().default(""),
  FIREBASE_MESSAGING_SENDER_ID: z.string().default(""),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,capacitor://localhost,https://localhost",
    ),
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),
  STRIPE_PRO_PRICE_ID: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().default(""),
  DAILY_API_KEY: z.string().default(""),
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default(""),
  GOOGLE_MAPS_SERVER_KEY: z.string().default(""),
  MARKETPLACE_DISCOVERY_MODE: z.enum(["open", "matched"]).default("open"),
  SMTP_HOST: z.string().default("smtp.office365.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  MICROSOFT_TENANT_ID: z.string().default(""),
  MICROSOFT_CLIENT_ID: z.string().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
  PUBLIC_SENTRY_DSN: z.string().default(""),
  SUPPORT_EMAIL: z.string().default(""),
  RENDER_GIT_COMMIT: z.string().default("local"),
});
export const env = envSchema.parse(process.env);
export const publicConfig: PublicConfig = {
  environment: env.APP_ENV,
  siteUrl: env.SITE_URL.replace(/\/$/, ""),
  apiUrl: env.API_URL.replace(/\/$/, ""),
  firebase: {
    apiKey: env.FIREBASE_WEB_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
    appId: env.FIREBASE_APP_ID,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  },
  sentryDsn: env.PUBLIC_SENTRY_DSN,
  release: env.RENDER_GIT_COMMIT,
  supportEmail: env.SUPPORT_EMAIL,
};
export function requiredKeys() {
  return [
    "DATABASE_URL",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_WEB_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_APP_ID",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "DAILY_API_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "GOOGLE_MAPS_SERVER_KEY",
    "SMTP_USER",
    "SMTP_FROM",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "SUPPORT_EMAIL",
  ] as const;
}
export function validateDeployment() {
  if (!env.API_URL.startsWith("https://"))
    throw new Error("API_URL must be HTTPS");
  const missing = requiredKeys().filter((k) => !env[k]);
  if (missing.length)
    throw new Error("Missing deployment configuration: " + missing.join(", "));
  if (!env.SITE_URL.startsWith("https://"))
    throw new Error("A deployed environment requires an HTTPS SITE_URL.");
  if (new URL(env.SITE_URL).origin !== env.SITE_URL)
    throw new Error(
      "SITE_URL must be the exact canonical origin without a path or trailing slash.",
    );
  if (new URL(env.API_URL).origin !== env.API_URL)
    throw new Error(
      "API_URL must be an exact origin without a path or trailing slash.",
    );
  if (
    env.APP_ENV !== "production" &&
    !env.STRIPE_SECRET_KEY.startsWith("sk_test_")
  )
    throw new Error("Development and stagging require Stripe test keys.");
  if (
    env.APP_ENV === "production" &&
    !env.STRIPE_SECRET_KEY.startsWith("sk_live_")
  )
    throw new Error("Production requires a Stripe live key.");
}

// The mail process does not use payments, authentication, maps, calls, or storage.
export function validateMailWorker(config: typeof env = env) {
  const keys = [
    "DATABASE_URL",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_FROM",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
  ] as const;
  const missing = keys.filter((key) => !config[key].trim());
  if (missing.length)
    throw new Error(
      "Missing email-worker configuration: " + missing.join(", "),
    );
  if (
    !Number.isInteger(config.SMTP_PORT) ||
    config.SMTP_PORT < 1 ||
    config.SMTP_PORT > 65535
  )
    throw new Error("SMTP_PORT must be a valid port number.");
}
