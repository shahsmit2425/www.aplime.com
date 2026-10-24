import { createHash } from "node:crypto";
import type { Request } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./integrations/redis.js";
import { env } from "./config.js";
import { clientNetwork } from "./client-ip.js";
import { fail } from "./errors.js";

// Local bound limits memory and Redis traffic; shared limits span API replicas.
export class FixedWindowBudget {
  private rows = new Map<string, { count: number; until: number }>();
  constructor(private maxKeys = 10000) {}
  take(key: string, limit: number, window: number, now = Date.now()) {
    let row = this.rows.get(key);
    if (!row || row.until <= now) {
      for (const [id, value] of this.rows)
        if (value.until <= now) this.rows.delete(id);
      if (!this.rows.has(key) && this.rows.size >= this.maxKeys) return false;
      row = { count: 0, until: now + window };
      this.rows.set(key, row);
    }
    if (row.count >= limit) return false;
    row.count++;
    return true;
  }
}
const policies = {
  signupIp: { limit: 5, seconds: 3600 },
  signupUser: { limit: 3, seconds: 3600 },
  projectIp: { limit: 20, seconds: 3600 },
  projectUser: { limit: 10, seconds: 3600 },
  publicLookup: { limit: env.PUBLIC_LOOKUP_DAILY_LIMIT, seconds: 86400 },
} as const;
const local = new FixedWindowBudget();
const shared = new Map<string, Ratelimit>();
export function requireLimitResult(result: {
  success: boolean;
  reason?: string;
}) {
  if (result.reason === "timeout")
    fail(
      503,
      "Safety checks are temporarily unavailable. Please try again shortly.",
    );
  if (!result.success) fail(429, "Too many requests. Please try again later.");
}
export async function consumeBudget(
  policy: keyof typeof policies,
  identity: string,
) {
  const { limit, seconds } = policies[policy];
  const key = createHash("sha256").update(identity).digest("hex");
  if (!local.take(policy + ":" + key, limit, seconds * 1000))
    fail(429, "Too many requests. Please try again later.");
  if (!redis) {
    if (env.NODE_ENV === "production")
      fail(
        503,
        "Safety checks are temporarily unavailable. Please try again shortly.",
      );
    return;
  }
  let limiter = shared.get(policy);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${seconds} s`),
      prefix: `aplime:${env.APP_ENV}:abuse:${policy}`,
      analytics: false,
    });
    shared.set(policy, limiter);
  }
  await checkSharedLimit(limiter, key);
}
export async function checkSharedLimit(
  limiter: Pick<Ratelimit, "limit">,
  key: string,
) {
  let result;
  try {
    result = await limiter.limit(key);
  } catch {
    fail(
      503,
      "Safety checks are temporarily unavailable. Please try again shortly.",
    );
  }
  requireLimitResult(result);
}

export async function guardCreation(kind: "signup" | "project", req: Request) {
  await consumeBudget(
    kind === "signup" ? "signupIp" : "projectIp",
    clientNetwork(req, req.app.get("trust proxy fn")),
  );
  await consumeBudget(
    kind === "signup" ? "signupUser" : "projectUser",
    req.identity.uid,
  );
}
