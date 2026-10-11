import { createHash } from "node:crypto";
import { env } from "../config.js";
import { requireValue, fail } from "../errors.js";
async function daily(path: string, body?: unknown) {
  const response = await fetch("https://api.daily.co/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + env.DAILY_API_KEY,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    fail(502, "The calling service is temporarily unavailable.");
  return response.json();
}
export async function meeting(
  meetingId: string,
  userId: string,
  name: string,
  audioOnly: boolean,
  endsAt: number,
) {
  requireValue(env.DAILY_API_KEY, "Calling is not configured yet.");
  if (endsAt <= Date.now()) fail(409, "This meeting has ended.");
  // Each scheduled meeting has a separate room. Old links cannot enter a later
  // meeting, and participant tokens expire at the scheduled end.
  const roomName =
    "st-" +
    createHash("sha256")
      .update(env.APP_ENV + ":" + meetingId + ":" + endsAt)
      .digest("hex")
      .slice(0, 32);
  const response = await fetch("https://api.daily.co/v1/rooms/" + roomName, {
    headers: { Authorization: "Bearer " + env.DAILY_API_KEY },
    signal: AbortSignal.timeout(15000),
  });
  let room;
  if (response.status === 404) {
    try {
      room = await daily("rooms", {
        name: roomName,
        privacy: "private",
        properties: {
          enable_prejoin_ui: true,
          enable_chat: false,
          enable_recording: false,
          max_participants: 2,
          exp: Math.floor(endsAt / 1000),
          eject_at_room_exp: true,
        },
      });
    } catch {
      room = await daily("rooms/" + roomName);
    }
  } else if (response.ok) room = await response.json();
  else fail(502, "The calling service is temporarily unavailable.");
  if (endsAt <= Date.now()) fail(409, "This meeting has ended.");
  const { token } = await daily("meeting-tokens", {
    properties: {
      room_name: roomName,
      user_id: userId,
      user_name: name,
      exp: Math.floor(endsAt / 1000),
      eject_at_token_exp: true,
      is_owner: false,
      start_video_off: audioOnly,
      enable_recording_ui: false,
    },
  });
  return { url: room.url + "?t=" + encodeURIComponent(token) };
}
