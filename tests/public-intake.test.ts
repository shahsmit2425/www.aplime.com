import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
process.env.GOOGLE_MAPS_SERVER_KEY = "test-server-only-key";
process.env.REDIS_URL = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const { publicIntake } = await import("../src/server/public-intake.js");
const { errorResponse } = await import("../src/server/error-response.js");
test("anonymous intake exposes bounded NJ lookups, not creation, credentials or exact coordinates", async () => {
  const app = express();
  app.use("/intake/locations", publicIntake);
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const result = errorResponse(error);
      res.status(result.status).json(result.body);
    },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const original = global.fetch;
  let providerCalls = 0;
  global.fetch = (async (input, init) => {
    const url = String(input);
    if (url.startsWith(base)) return original(input, init);
    providerCalls++;
    if (url.includes("geocode")) {
      const ny = url.includes("10001");
      const zip = ny ? "10001" : "08859";
      return Response.json({
        status: "OK",
        results: [
          {
            formatted_address: ny ? "New York, NY 10001" : "Parlin, NJ 08859",
            geometry: { location: { lat: 40.4, lng: -74.3 } },
            address_components: [
              { types: ["postal_code"], long_name: zip },
              { types: ["country"], short_name: "US" },
              {
                types: ["administrative_area_level_1"],
                short_name: ny ? "NY" : "NJ",
              },
            ],
          },
        ],
      });
    }
    if (url.includes("autocomplete"))
      return Response.json({
        suggestions: [
          {
            placePrediction: {
              placeId: "place-test",
              text: { text: "1 Test St, Parlin, NJ" },
            },
          },
        ],
      });
    return Response.json({
      id: "place-test",
      formattedAddress: "1 Test St, Parlin, NJ 08859",
      location: { latitude: 40.4, longitude: -74.3 },
      addressComponents: [
        { types: ["postal_code"], longText: "08859" },
        { types: ["country"], shortText: "US" },
        { types: ["administrative_area_level_1"], shortText: "NJ" },
        { types: ["street_number"], longText: "1" },
        { types: ["route"], longText: "Test St" },
      ],
    });
  }) as typeof fetch;
  try {
    const invalid = await fetch(base + "/intake/locations/zip?zip=bad");
    assert.equal(invalid.status, 400);
    assert.equal(providerCalls, 0);
    const outside = await fetch(base + "/intake/locations/zip?zip=10001");
    assert.equal(outside.status, 400);
    assert.match((await outside.json()).error, /New Jersey/);
    const zip = await fetch(base + "/intake/locations/zip?zip=08859");
    assert.equal(zip.status, 200);
    assert.deepEqual(await zip.json(), {
      zip: "08859",
      label: "Parlin, NJ 08859",
    });
    const token = randomUUID();
    const autocomplete = await fetch(
      base + "/intake/locations/autocomplete?q=Test&sessionToken=" + token,
    );
    assert.equal(autocomplete.status, 200);
    const address = await fetch(
      base +
        "/intake/locations/details?placeId=place-test&sessionToken=" +
        token,
    );
    const body = await address.json();
    assert.deepEqual(Object.keys(body).sort(), ["label", "placeId", "zip"]);
    assert.equal(address.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(body), /test-server-only-key/);
    assert.equal(
      (await fetch(base + "/intake/locations/projects", { method: "POST" }))
        .status,
      404,
    );
    let last: Response | undefined;
    for (let i = 0; i < 91; i++)
      last = await fetch(base + "/intake/locations/zip?zip=bad");
    assert.equal(last?.status, 429);
  } finally {
    global.fetch = original;
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
