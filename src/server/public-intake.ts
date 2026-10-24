import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { createHash } from "node:crypto";
import { redis as rateLimitRedis } from "./integrations/redis.js";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "./config.js";
import {
  autocompleteAddress,
  locateAddress,
  assertServiceArea,
} from "./integrations/address.js";
import { locate } from "./integrations/maps.js";
import { cachedValue } from "./redis.js";
import { fail } from "./errors.js";

// Only address lookup is public. Project creation, uploads and recommendations
// still require a verified customer and server-side authorization.
const lookupLimiter = rateLimitRedis
  ? new Ratelimit({
      redis: rateLimitRedis,
      limiter: Ratelimit.slidingWindow(90, "10 m"),
      prefix: "aplime:" + env.APP_ENV + ":intake",
      analytics: false,
    })
  : null;
export const publicIntake = Router();
publicIntake.use(
  rateLimit({
    windowMs: 10 * 60_000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many address lookups. Please try again in a few minutes.",
    },
  }),
);
publicIntake.use(async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (lookupLimiter) {
    const ip = createHash("sha256")
      .update(ipKeyGenerator(req.ip || "unknown"))
      .digest("hex");
    const result = await lookupLimiter.limit("public-intake:" + ip);
    if (!result.success)
      fail(429, "Too many address lookups. Please try again shortly.");
  }
  next();
});
publicIntake.get("/zip", async (req, res) => {
  const zip = z
    .string()
    .regex(/^\d{5}$/, "Enter a five-digit ZIP code.")
    .parse(req.query.zip);
  const location = await cachedValue("intake-zip:" + zip, 86400, () =>
    locate(zip),
  );
  if (!location || location.zip !== zip || location.country !== "US")
    fail(400, "Enter a valid US ZIP code.");
  assertServiceArea(location);
  res.json({ zip, label: location.label });
});
publicIntake.get("/autocomplete", async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().min(3).max(200),
      sessionToken: z.string().uuid(),
    })
    .parse(req.query);
  res.json(await autocompleteAddress(q.q, q.sessionToken));
});
publicIntake.get("/details", async (req, res) => {
  const q = z
    .object({
      placeId: z.string().min(3).max(300),
      sessionToken: z.string().uuid(),
    })
    .parse(req.query);
  const location = await locateAddress(q.placeId, q.sessionToken);
  assertServiceArea(location);
  res.json({
    label: location.label,
    placeId: location.placeId,
    zip: location.zip,
  });
});
