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
