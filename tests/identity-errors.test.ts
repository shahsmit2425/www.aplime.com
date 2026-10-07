import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { identityFailure } from "../src/server/integrations/identity-error.js";
import { errorResponse } from "../src/server/error-response.js";

test("Stripe Identity errors expose safe support references and exclude provider secrets", () => {
  const error = new Stripe.errors.StripePermissionError({
    type: "invalid_request_error",
    message: "PRIVATE_SECRET_AND_ID_DOCUMENT",
    code: "account_invalid",
    param: "return_url",
  });
  Object.assign(error, { statusCode: 403, requestId: "req_TestReference123" });
  const safe = identityFailure(error, "create");
  assert.equal(safe.code, "IDENTITY_CONFIGURATION_ERROR");
  assert.deepEqual(safe.diagnostic, {
    operation: "create",
    reason: "StripePermissionError",
    upstreamStatus: 403,
    providerCode: "account_invalid",
    parameter: "return_url",
    requestId: "req_TestReference123",
  });
  const response = errorResponse(safe);
  assert.equal(response.status, 503);
  assert.ok("requestId" in response.body);
  assert.equal(response.body.requestId, "req_TestReference123");
  assert.equal(response.body.code, "IDENTITY_CONFIGURATION_ERROR");
  assert.equal(
    JSON.stringify([response, safe]).includes("PRIVATE_SECRET"),
    false,
  );
  const hostile = identityFailure(
    {
      type: "PRIVATE",
      code: "PRIVATE",
      param: "PRIVATE",
      requestId: "req_unsafe/private",
      message: "PRIVATE",
    },
    "retrieve",
  );
  assert.equal(
    JSON.stringify([hostile, errorResponse(hostile)]).includes("PRIVATE"),
    false,
  );
});

test("Identity distinguishes missing sessions, request conflicts, authentication, limits and outages", () => {
  for (const [type, code, statusCode, operation, expected] of [
    [
      "StripeInvalidRequestError",
      "resource_missing",
      404,
      "retrieve",
      "IDENTITY_SESSION_UNAVAILABLE",
    ],
    [
      "StripeInvalidRequestError",
      "resource_missing",
      404,
      "create",
      "IDENTITY_CONFIGURATION_ERROR",
    ],
    [
      "StripeAuthenticationError",
      "api_key_expired",
      401,
      "create",
      "IDENTITY_CONFIGURATION_ERROR",
    ],
    [
      "StripeIdempotencyError",
      undefined,
      400,
      "create",
      "IDENTITY_CONFIGURATION_ERROR",
    ],
    [
      "StripeRateLimitError",
      "rate_limit",
      429,
      "retrieve",
      "IDENTITY_RATE_LIMITED",
    ],
    [
      "StripeConnectionError",
      undefined,
      undefined,
      "create",
      "IDENTITY_UNAVAILABLE",
    ],
    ["StripeAPIError", undefined, 500, "create", "IDENTITY_UNAVAILABLE"],
  ] as const)
    assert.equal(
      identityFailure({ type, code, statusCode }, operation).code,
      expected,
    );
});
