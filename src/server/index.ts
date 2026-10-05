import { closeNotificationStream } from "./notification-stream.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { errorResponse } from "./error-response.js";
import { AddressError } from "./integrations/address-error.js";
import { env, publicConfig, validateDeployment } from "./config.js";
import { api } from "./api.js";
import { webhooks } from "./webhooks.js";
import { pool } from "./db/index.js";
if (env.NODE_ENV === "production") validateDeployment();
if (env.SENTRY_DSN)
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      return event;
    },
  });
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const origins = new Set([
  ...env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
  env.SITE_URL,
]);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseapp.com",
          "https://*.sentry.io",
          "https://*.ingest.us.sentry.io",
          "https://*.ingest.de.sentry.io",
          "https://*.r2.cloudflarestorage.com",
          ...(env.NODE_ENV === "development"
            ? ["ws://127.0.0.1:*", "ws://localhost:*"]
            : []),
        ],
        imgSrc: ["'self'", "data:", "https:"],
        frameSrc: [
          "https://*.firebaseapp.com",
          "https://*.google.com",
          "https://appleid.apple.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
app.use(
  cors({
    origin(origin, cb) {
      cb(null, !origin || origins.has(origin));
    },
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use((_q, r, next) => {
  r.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api/webhooks", webhooks);
app.use("/api", api);
app.use("/api", (_q, r) =>
  r.status(404).json({ error: "Endpoint not found." }),
);
app.use((_q, r) => r.status(404).json({ error: "Endpoint not found." }));
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const e = (error || {}) as { code?: string };
    const { status, body } = errorResponse(error);
    if (status >= 500) {
      console.error(
        "Request failed",
        e.code || "internal",
        error instanceof AddressError ? error.diagnostic : {},
      );
      Sentry.captureException(error);
    }
    res.status(status).json(body);
  },
);
const http = app.listen(env.PORT, "0.0.0.0", () =>
  console.log("Aplime API: " + env.API_URL),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    closeNotificationStream();
    http.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
