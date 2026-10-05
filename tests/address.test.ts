import test from "node:test";
import assert from "node:assert/strict";
process.env.GOOGLE_MAPS_SERVER_KEY = "server-only-test-key";
test("address suggestions use Places New with session token and bounded results", async () => {
  const { autocompleteAddress, locateAddress } =
    await import("../src/server/integrations/address.js");
  const original = global.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  global.fetch = (async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (String(input).includes("places:autocomplete"))
      return Response.json({
        suggestions: Array.from({ length: 8 }, (_, i) => ({
          placePrediction: {
            placeId: "place-" + i,
            text: { text: "Address " + i },
          },
        })),
      });
    return Response.json({
      id: "place-0",
      formattedAddress: "350 Fifth Avenue, New York, NY 10118",
      location: { latitude: 40.7, longitude: -74 },
      addressComponents: [
        { types: ["country"], shortText: "US" },
        { types: ["postal_code"], longText: "10118" },
        { types: ["street_number"], longText: "350" },
        { types: ["route"], longText: "Fifth Avenue" },
      ],
    });
  }) as typeof fetch;
  try {
    assert.equal((await autocompleteAddress("350 Fifth", "session")).length, 5);
    const body = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(body.includedRegionCodes, ["us"]);
    assert.equal(body.sessionToken, "session");
    const result = await locateAddress("place-0", "session");
    assert.equal(result.zip, "10118");
    assert.ok(calls[1].url.endsWith("?sessionToken=session"));
    assert.equal(
      JSON.stringify(result).includes("server-only-test-key"),
      false,
    );
    global.fetch = (async () =>
      Response.json({
        addressComponents: [
          { types: ["country"], shortText: "US" },
          { types: ["postal_code"], longText: "10118" },
        ],
        location: { latitude: 40, longitude: -74 },
      })) as typeof fetch;
    await assert.rejects(
      locateAddress("city-only"),
      /complete US street address/,
    );
    global.fetch = (async () =>
      new Response(null, { status: 403 })) as typeof fetch;
    await assert.rejects(autocompleteAddress("abc", "session"), /unavailable/);
  } finally {
    global.fetch = original;
  }
});

test("address failures provide safe diagnostics and never leak provider secrets", async () => {
  const { autocompleteAddress } =
    await import("../src/server/integrations/address.js");
  const { env } = await import("../src/server/config.js");
  const { AddressError } =
    await import("../src/server/integrations/address-error.js");
  const { errorResponse } = await import("../src/server/error-response.js");
  const original = global.fetch;
  const key = env.GOOGLE_MAPS_SERVER_KEY;
  try {
    for (const [status, code, reason] of [
      [400, "ADDRESS_CONFIGURATION_ERROR", "API_KEY_INVALID"],
      [403, "ADDRESS_CONFIGURATION_ERROR", "SERVICE_DISABLED"],
      [403, "ADDRESS_CONFIGURATION_ERROR", "API_KEY_HTTP_REFERRER_BLOCKED"],
      [429, "ADDRESS_RATE_LIMITED", "RATE_LIMIT_EXCEEDED"],
      [500, "ADDRESS_UNAVAILABLE", "secret-provider-message"],
    ] as const) {
      global.fetch = (async () =>
        Response.json(
          {
            error: {
              message: "private-address private-project secret-key",
              details: [{ reason }],
            },
          },
          { status },
        )) as typeof fetch;
      await assert.rejects(
        autocompleteAddress("private-address", "session"),
        (error: unknown) => {
          assert.ok(error instanceof AddressError);
          assert.equal(error.code, code);
          assert.equal(error.diagnostic.upstreamStatus, status);
          assert.equal(
            error.diagnostic.reason,
            status === 500 ? undefined : reason,
          );
          const response = errorResponse(error);
          assert.equal(response.status, 503);
          assert.equal(response.body.code, code);
          assert.doesNotMatch(
            JSON.stringify(error) + JSON.stringify(response),
            /private-address|private-project|secret-key|secret-provider-message/,
          );
          return true;
        },
      );
    }
    for (const [name, code] of [
      ["TimeoutError", "ADDRESS_TIMEOUT"],
      ["TypeError", "ADDRESS_UNAVAILABLE"],
    ]) {
      global.fetch = (async () => {
        throw Object.assign(new Error("private connection detail"), { name });
      }) as typeof fetch;
      await assert.rejects(autocompleteAddress("abc", "session"), { code });
    }
    global.fetch = (async () => Response.json({})) as typeof fetch;
    assert.deepEqual(await autocompleteAddress("kjnjnnmnm", "session"), []);
    global.fetch = (async () =>
      Response.json({ suggestions: "invalid" })) as typeof fetch;
    await assert.rejects(autocompleteAddress("abc", "session"), {
      code: "ADDRESS_UNAVAILABLE",
    });
    env.GOOGLE_MAPS_SERVER_KEY = "   ";
    await assert.rejects(autocompleteAddress("abc", "session"), {
      code: "ADDRESS_NOT_CONFIGURED",
    });
    assert.equal(
      errorResponse(new Error("database password secret")).body.error,
      "The service is temporarily unavailable. Please try again.",
    );
    assert.equal(
      errorResponse(Object.assign(new Error("untrusted 503"), { status: 503 }))
        .body.error,
      "The service is temporarily unavailable. Please try again.",
    );
  } finally {
    global.fetch = original;
    env.GOOGLE_MAPS_SERVER_KEY = key;
  }
});
