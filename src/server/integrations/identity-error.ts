const messages = {
  IDENTITY_CONFIGURATION_ERROR:
    "Identity verification is unavailable because of a setup issue. Please contact support.",
  IDENTITY_SESSION_UNAVAILABLE:
    "Your saved verification session could not be opened. Please contact support to restore verification.",
  IDENTITY_RATE_LIMITED:
    "Identity verification is busy. Please wait a moment and try again.",
  IDENTITY_UNAVAILABLE:
    "Identity verification is temporarily unavailable. Please try again shortly.",
} as const;
export class IdentityError extends Error {
  readonly status = 503;
  constructor(
    readonly code: keyof typeof messages,
    readonly diagnostic: {
      operation: "create" | "retrieve" | "check";
      reason: string;
      upstreamStatus?: number;
      providerCode?: string;
      parameter?: string;
      requestId?: string;
    },
  ) {
    super(messages[code]);
    this.name = "IdentityError";
  }
}

export function identityFailure(
  error: unknown,
  operation: "create" | "retrieve" | "check",
) {
  if (error instanceof IdentityError) return error;
  const e = (error || {}) as {
    type?: string;
    code?: string;
    statusCode?: number;
    param?: string;
    requestId?: string;
  };
  // Never retain raw messages/response objects: they can contain secrets or ID data.
  const types = [
    "StripeAuthenticationError",
    "StripePermissionError",
    "StripeInvalidRequestError",
    "StripeIdempotencyError",
    "StripeRateLimitError",
    "StripeConnectionError",
    "StripeAPIError",
  ];
  const codes = [
    "resource_missing",
    "api_key_expired",
    "secret_key_required",
    "account_invalid",
    "parameter_missing",
    "parameter_unknown",
    "parameter_invalid_empty",
    "parameter_invalid_integer",
    "parameter_invalid_string_blank",
    "parameter_invalid_string_empty",
    "url_invalid",
    "idempotency_key_in_use",
    "rate_limit",
  ];
  const params = [
    "return_url",
    "type",
    "verification_flow",
    "verification_session",
    "options[document][require_matching_selfie]",
  ];
  const reason = types.includes(e.type || "")
    ? e.type!
    : "UNKNOWN_PROVIDER_ERROR";
  const diagnostic = {
    operation,
    reason,
    ...(typeof e.statusCode === "number"
      ? { upstreamStatus: e.statusCode }
      : {}),
    ...(codes.includes(e.code || "") ? { providerCode: e.code } : {}),
    ...(params.includes(e.param || "") ? { parameter: e.param } : {}),
    ...(typeof e.requestId === "string" &&
    /^req_[A-Za-z0-9]{1,80}$/.test(e.requestId)
      ? { requestId: e.requestId }
      : {}),
  };
  const missingSession =
    operation === "retrieve" &&
    e.type === "StripeInvalidRequestError" &&
    e.code === "resource_missing";
  const setupFailure =
    [
      "StripeAuthenticationError",
      "StripePermissionError",
      "StripeInvalidRequestError",
      "StripeIdempotencyError",
    ].includes(e.type || "") || [400, 401, 403].includes(e.statusCode || 0);
  return new IdentityError(
    missingSession
      ? "IDENTITY_SESSION_UNAVAILABLE"
      : e.type === "StripeRateLimitError" || e.statusCode === 429
        ? "IDENTITY_RATE_LIMITED"
        : setupFailure
          ? "IDENTITY_CONFIGURATION_ERROR"
          : "IDENTITY_UNAVAILABLE",
    diagnostic,
  );
}
