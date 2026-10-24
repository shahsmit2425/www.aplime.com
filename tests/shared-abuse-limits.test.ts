import test from "node:test";
import assert from "node:assert/strict";
import { checkSharedLimit } from "../src/server/abuse-limits.js";
test("shared limiter blocks denials, timeouts and outages without exposing provider errors", async () => {
  const denied = { limit: async () => ({ success: false }) } as any;
  await assert.rejects(() => checkSharedLimit(denied, "denied"), {
    status: 429,
  });
  const timeout = {
    limit: async () => ({ success: true, reason: "timeout" }),
  } as any;
  await assert.rejects(() => checkSharedLimit(timeout, "timeout"), {
    status: 503,
  });
  const offline = {
    limit: async () => {
      throw new Error("private provider error");
    },
  } as any;
  await assert.rejects(
    () => checkSharedLimit(offline, "offline"),
    (e: any) => e.status === 503 && !e.message.includes("private"),
  );
  await checkSharedLimit(
    { limit: async () => ({ success: true }) } as any,
    "healthy",
  );
});
