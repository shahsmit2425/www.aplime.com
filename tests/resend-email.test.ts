import test from "node:test";
import assert from "node:assert/strict";
process.env.RESEND_API_KEY = "re_test_private_fixture";
process.env.EMAIL_FROM = "notification@example.invalid";
process.env.EMAIL_REPLY_TO = "support@example.invalid";
const { sendEmail, EmailDeliveryError } =
  await import("../src/server/integrations/email.js");
const { env, publicConfig, requiredKeys } =
  await import("../src/server/config.js");

test("Resend sends the existing template with a stable per-outbox idempotency key and no public credentials", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    calls.push(init!);
    return Response.json({ id: "mail-provider-id" });
  }) as typeof fetch;
  const send = (id: string) =>
    sendEmail(
      "customer@example.invalid",
      "New service opportunity",
      "Plain text",
      "<p>Plain text</p>",
      id,
    );
  assert.deepEqual(await send("<aplime.outbox-one@example.invalid>"), {
    id: "mail-provider-id",
  });
  await send("<aplime.outbox-one@example.invalid>");
  await send("<aplime.outbox-two@example.invalid>");
  const headers = calls.map((call) => new Headers(call.headers));
  assert.equal(headers[0].get("authorization"), "Bearer " + env.RESEND_API_KEY);
  assert.equal(headers[0].get("user-agent"), "aplime/0.2.0");
  assert.equal(
    headers[0].get("idempotency-key"),
    headers[1].get("idempotency-key"),
  );
  assert.notEqual(
    headers[0].get("idempotency-key"),
    headers[2].get("idempotency-key"),
  );
  assert.deepEqual(JSON.parse(String(calls[0].body)), {
    from: env.EMAIL_FROM,
    to: ["customer@example.invalid"],
    subject: "New service opportunity",
    text: "Plain text",
    html: "<p>Plain text</p>",
    reply_to: env.EMAIL_REPLY_TO,
    headers: { "Message-ID": "<aplime.outbox-one@example.invalid>" },
  });
  assert.equal(calls[0].method, "POST");
  assert.ok(calls[0].signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(publicConfig).includes(env.RESEND_API_KEY));
  assert.ok(requiredKeys().includes("RESEND_API_KEY"));
  assert.ok(!requiredKeys().some((key) => /SMTP|MICROSOFT/.test(key)));
});

test("Resend failures remain retryable and expose only safe status/codes", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const status of [400, 401, 403, 409, 429, 500, 503]) {
    globalThis.fetch = (async () =>
      Response.json(
        {
          name: status === 429 ? "rate_limit_exceeded" : "provider-secret",
          message: "private-email re_secret token",
        },
        { status },
      )) as typeof fetch;
    await assert.rejects(
      () => sendEmail("customer@example.invalid", "Subject", "Body"),
      (error: unknown) => {
        assert.ok(error instanceof EmailDeliveryError);
        assert.equal(error.status, status);
        assert.equal(
          error.code,
          status === 429 ? "rate_limit_exceeded" : "provider_rejected",
        );
        assert.ok(!String(error).includes("secret"));
        return true;
      },
    );
  }
  for (const body of [null, {}, { id: "" }, { id: 123 }]) {
    globalThis.fetch = (async () => Response.json(body)) as typeof fetch;
    await assert.rejects(
      () => sendEmail("customer@example.invalid", "Subject", "Body"),
      /invalid_response/,
    );
  }
  globalThis.fetch = (async () =>
    new Response("<html>upstream unavailable</html>", {
      status: 502,
    })) as typeof fetch;
  await assert.rejects(
    () => sendEmail("customer@example.invalid", "Subject", "Body"),
    /invalid_response/,
  );
  globalThis.fetch = (async () => {
    throw new Error("private network detail");
  }) as typeof fetch;
  await assert.rejects(
    () => sendEmail("customer@example.invalid", "Subject", "Body"),
    /network_or_timeout/,
  );
});

test("plain-text delivery omits unset optional fields and missing credentials never make a request", async (t) => {
  const original = globalThis.fetch,
    reply = env.EMAIL_REPLY_TO,
    key = env.RESEND_API_KEY;
  t.after(() => {
    globalThis.fetch = original;
    env.EMAIL_REPLY_TO = reply;
    env.RESEND_API_KEY = key;
  });
  env.EMAIL_REPLY_TO = "";
  let calls = 0;
  globalThis.fetch = (async (_url, init) => {
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)), {
      from: env.EMAIL_FROM,
      to: ["customer@example.invalid"],
      subject: "Subject",
      text: "Body",
    });
    return Response.json({ id: "accepted" });
  }) as typeof fetch;
  await sendEmail("customer@example.invalid", "Subject", "Body");
  env.RESEND_API_KEY = "";
  await assert.rejects(
    () => sendEmail("customer@example.invalid", "Subject", "Body"),
    /RESEND_API_KEY/,
  );
  assert.equal(calls, 1);
});
