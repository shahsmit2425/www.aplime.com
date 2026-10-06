import test from "node:test";
import assert from "node:assert/strict";
import { appointmentIcs, directionsUrl } from "../src/client/calendar.js";
import { actionSchema } from "../src/shared/domain.js";

test("calendar files escape text and describe a one-hour event", () => {
  const ics = appointmentIcs({
    id: "abc",
    title: "Fix sink, kitchen; urgent",
    startsAt: "2030-01-02T15:00:00.000Z",
    location: "1 Main St, Austin",
  });
  assert.match(ics, /DTSTART:20300102T150000Z/);
  assert.match(ics, /DTEND:20300102T160000Z/);
  assert.ok(ics.includes("SUMMARY:Fix sink\\, kitchen\\; urgent\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.split("\r\n").every((line) => line.length <= 75));
});

test("directions links encode the destination", () => {
  assert.equal(
    directionsUrl("1 Main St & 2nd"),
    "https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St%20%26%202nd",
  );
});

test("update_details validates budget order and rejects extra fields", () => {
  const base = {
    type: "update_details",
    title: "A project title",
    description: "A sufficiently long project description.",
    urgency: "flexible",
    budgetMin: 100,
    budgetMax: 200,
  };
  assert.ok(actionSchema.safeParse(base).success);
  assert.ok(!actionSchema.safeParse({ ...base, budgetMin: 300 }).success);
  assert.ok(!actionSchema.safeParse({ ...base, status: "completed" }).success);
});
