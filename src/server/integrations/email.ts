import { createHash, randomUUID } from "node:crypto";
import { env, validateEmailDelivery } from "../config.js";

const providerCodes = new Set([
  "validation_error",
  "missing_api_key",
  "invalid_api_key",
  "restricted_api_key",
  "invalid_from_address",
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "application_error",
  "internal_server_error",
  "invalid_idempotent_request",
  "concurrent_idempotent_requests",
]);
export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(`Email delivery failed: ${code}${status ? ` (HTTP ${status})` : ""}`);
  }
}

// One HTTP attempt; the transactional outbox owns retries and recipient policy.
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  messageId?: string,
) {
  validateEmailDelivery();
  const key =
    "aplime/" +
    createHash("sha256")
      .update(messageId || randomUUID())
      .digest("hex");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "aplime/0.2.0",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        text,
        ...(html !== undefined ? { html } : {}),
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
        ...(messageId ? { headers: { "Message-ID": messageId } } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new EmailDeliveryError("network_or_timeout");
  }
  let result: { id?: unknown; name?: unknown };
  try {
    result = await response.json();
  } catch {
    throw new EmailDeliveryError("invalid_response", response.status);
  }
  if (!response.ok) {
    const code =
      typeof result?.name === "string" && providerCodes.has(result.name)
        ? result.name
        : "provider_rejected";
    throw new EmailDeliveryError(code, response.status);
  }
  if (
    !result ||
    typeof result.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(result.id)
  )
    throw new EmailDeliveryError("invalid_response", response.status);
  return { id: result.id };
}
