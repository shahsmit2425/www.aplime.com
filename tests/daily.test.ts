import test from "node:test";
import assert from "node:assert/strict";

process.env.DAILY_API_KEY = "daily_test_server_key";
process.env.APP_ENV = "development";

test("Daily calls use one private two-person room and participant-scoped tokens", async () => {
  const { meeting } = await import("../src/server/integrations/daily.js");
  const originalFetch = global.fetch;
  const requests: { url: string; method: string; body?: any }[] = [];
  let roomExists = false;
  global.fetch = (async (input: string | URL | Request, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    if (url.includes("/rooms/") && method === "GET")
      return roomExists
        ? Response.json({ url: "https://aplime.daily.co/private-room" })
        : new Response(null, { status: 404 });
    if (url.endsWith("/rooms") && method === "POST") {
      roomExists = true;
      return Response.json({ url: "https://aplime.daily.co/private-room" });
    }
    if (url.endsWith("/meeting-tokens") && method === "POST")
      return Response.json({ token: "short-lived-token" });
    return new Response(null, { status: 500 });
  }) as typeof fetch;
  try {
    const audio = await meeting(
      "discussion-123",
      "professional-1",
      "Alex Professional",
      true,
    );
    const video = await meeting(
      "discussion-123",
      "customer-1",
      "Casey Customer",
      false,
    );
    assert.equal(
      audio.url,
      "https://aplime.daily.co/private-room?t=short-lived-token",
    );
    assert.equal(video.url, audio.url);
    const roomRequest = requests.find(
      (request) => request.url.endsWith("/rooms") && request.method === "POST",
    );
    assert.equal(roomRequest?.body.privacy, "private");
    assert.equal(roomRequest?.body.properties.max_participants, 2);
    assert.equal(roomRequest?.body.properties.enable_recording, false);
    assert.equal(roomRequest?.body.properties.enable_chat, false);
    const tokens = requests.filter((request) =>
      request.url.endsWith("/meeting-tokens"),
    );
    assert.equal(tokens.length, 2);
    assert.equal(
      tokens[0].body.properties.room_name,
      tokens[1].body.properties.room_name,
    );
    assert.equal(tokens[0].body.properties.user_id, "professional-1");
    assert.equal(tokens[1].body.properties.user_id, "customer-1");
    assert.equal(tokens[0].body.properties.start_video_off, true);
    assert.equal(tokens[1].body.properties.start_video_off, false);
    assert.equal(tokens[0].body.properties.is_owner, false);
    assert.equal(tokens[0].body.properties.eject_at_token_exp, true);
    const secondsRemaining =
      tokens[0].body.properties.exp - Math.floor(Date.now() / 1000);
    assert.ok(secondsRemaining >= 3595 && secondsRemaining <= 3600);
  } finally {
    global.fetch = originalFetch;
  }
});
