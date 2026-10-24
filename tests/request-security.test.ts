import test from "node:test";
import assert from "node:assert/strict";
import { request, type IncomingMessage } from "node:http";
import { once } from "node:events";
import express from "express";
import { canonicalRedirect } from "../apps/web/redirects.js";
process.env.NODE_ENV = "test";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.PUBLIC_LOOKUP_DAILY_LIMIT = "3";
const { clientIp, clientNetwork } = await import("../src/server/client-ip.js");
const { FixedWindowBudget, requireLimitResult, consumeBudget, guardCreation } =
  await import("../src/server/abuse-limits.js");

function incoming(header?: string, peer = "10.0.0.1") {
  return {
    headers: { "x-forwarded-for": header },
    socket: { remoteAddress: peer },
  } as unknown as IncomingMessage;
}
test("proxy policy ignores spoofed prefixes and uses the same client network for HTTP and upgrades", () => {
  const req = incoming("198.51.100.99, 203.0.113.8");
  assert.equal(clientIp(req), "10.0.0.1");
  const app = express();
  app.set("trust proxy", 1);
  const trust = app.get("trust proxy fn");
  assert.equal(clientIp(req, trust), "203.0.113.8");
  assert.equal(
    clientIp(incoming("malformed, 203.0.113.8"), trust),
    "203.0.113.8",
  );
  assert.equal(clientIp(incoming("malformed"), trust), "10.0.0.1");
  app.set("trust proxy", ["10.0.0.0/8"]);
  assert.equal(
    clientIp(
      incoming("198.51.100.99, 203.0.113.8, 10.1.1.1"),
      app.get("trust proxy fn"),
    ),
    "203.0.113.8",
  );
  assert.equal(
    clientNetwork(incoming("2001:db8:abcd:1200::1"), trust),
    clientNetwork(incoming("2001:db8:abcd:12ff::2"), trust),
  );
  assert.notEqual(
    clientNetwork(incoming("203.0.113.8"), trust),
    clientNetwork(incoming("203.0.113.9"), trust),
  );
});

test("redirects reject authority-like paths and preserve safe paths and query strings", async () => {
  const app = express();
  app.use(canonicalRedirect(new URL("https://aplime.example"), true));
  app.use((_q, r) => r.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const get = (path: string, host = "aplime.example") =>
    new Promise<{ status?: number; location?: string }>((resolve, reject) => {
      const r = request(
        { hostname: "127.0.0.1", port, path, headers: { host } },
        (res) => {
          res.resume();
          res.on("end", () =>
            resolve({ status: res.statusCode, location: res.headers.location }),
          );
        },
      );
      r.on("error", reject);
      r.end();
    });
  try {
    for (const path of [
      "//evil.example/",
      "/%2fevil.example/",
      "/%5cevil.example/",
      "/%0devil.example/",
      "/bad%zz/",
    ]) {
      const result = await get(path);
      assert.equal(result.status, 400, path);
      assert.equal(result.location, undefined, path);
    }
    assert.deepEqual(await get("/cleaning/?next=https://other.example"), {
      status: 308,
      location: "/cleaning?next=https://other.example",
    });
    assert.deepEqual(await get("/cleaning/", "attacker.example"), {
      status: 308,
      location: "https://aplime.example/cleaning",
    });
    assert.equal((await get("/cleaning")).status, 204);
    assert.equal((await get("/")).status, 204);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("bounded budgets enforce independent windows and fail closed on shared-store timeout", () => {
  const b = new FixedWindowBudget(2);
  assert.equal(b.take("a", 2, 100, 0), true);
  assert.equal(b.take("a", 2, 100, 1), true);
  assert.equal(b.take("a", 2, 100, 2), false);
  assert.equal(b.take("b", 2, 100, 2), true);
  assert.equal(b.take("c", 2, 100, 3), false);
  assert.equal(b.take("a", 2, 100, 100), true);
  assert.throws(
    () => requireLimitResult({ success: true, reason: "timeout" }),
    { status: 503 },
  );
  assert.throws(() => requireLimitResult({ success: false }), { status: 429 });
});
test("daily public lookup budget stops distributed identities at one shared policy budget", async () => {
  for (let i = 0; i < 3; i++)
    await consumeBudget("publicLookup", "all-public-lookups");
  await assert.rejects(
    () => consumeBudget("publicLookup", "all-public-lookups"),
    { status: 429 },
  );
});
test("account creation and project bursts are bounded by both client and identity", async () => {
  const app = express();
  app.set("trust proxy", 1);
  const req = (ip: string, uid: string) =>
    Object.assign(incoming(ip), { app, identity: { uid } }) as any;
  for (let i = 0; i < 5; i++)
    await guardCreation("signup", req("203.0.113.10", "signup" + i));
  await assert.rejects(
    () => guardCreation("signup", req("203.0.113.10", "sixth")),
    { status: 429 },
  );
  await guardCreation("signup", req("203.0.113.11", "other"));
  for (let i = 0; i < 10; i++)
    await guardCreation("project", req("203.0.113.20", "customer"));
  await assert.rejects(
    () => guardCreation("project", req("203.0.113.21", "customer")),
    { status: 429 },
  );
});
