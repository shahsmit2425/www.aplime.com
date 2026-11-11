import test from "node:test";
import assert from "node:assert/strict";
import {
  preferencesSchema,
  withinWeeklyHours,
} from "../src/shared/preferences.js";
import { projectSchema } from "../src/shared/domain.js";
import { questionsFor } from "../src/shared/service-questionnaires.js";
test("preferences reject invalid categories, hours and zones", () => {
  const valid = {
    serviceCategories: ["Handyman", "Painting"],
    serviceRadiusMiles: 25,
    available: true,
    weeklyHours: { Mon: { start: "08:00", end: "17:00" } },
    timeZone: "America/New_York",
  };
  assert.ok(preferencesSchema.safeParse(valid).success);
  for (const change of [
    { serviceCategories: [] },
    { serviceCategories: ["Unknown"] },
    { serviceRadiusMiles: 101 },
    { timeZone: "fake/zone" },
    { weeklyHours: { Mon: { start: "18:00", end: "09:00" } } },
    { weeklyHours: { Mon: { start: "25:00", end: "26:00" } } },
    { admin: true },
  ])
    assert.equal(
      preferencesSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
test("weekly hours use professional timezone and daylight saving offsets", () => {
  const hours = { Mon: { start: "08:00", end: "17:00" } };
  assert.equal(
    withinWeeklyHours("2030-07-01T12:00:00Z", hours, "America/New_York"),
    true,
  );
  assert.equal(
    withinWeeklyHours("2030-07-01T21:00:00Z", hours, "America/New_York"),
    false,
  );
  assert.equal(
    withinWeeklyHours("2030-01-07T12:00:00Z", hours, "America/New_York"),
    false,
  );
  assert.equal(
    withinWeeklyHours("2030-01-07T13:00:00Z", hours, "America/New_York"),
    true,
  );
  assert.equal(
    withinWeeklyHours("2030-07-02T12:00:00Z", hours, "America/New_York"),
    false,
  );
});
test("project publication requires a selected address, bounded unit, and questionnaire", () => {
  const input = {
    title: "Repair a door",
    description: "The front door does not close correctly.",
    category: "Handyman",
    address: "350 Fifth Avenue, New York, NY 10118",
    placeId: "test-place",
    addressUnit: "Suite 2",
    intake: Object.fromEntries(
      questionsFor("Handyman").map((q) => [
        q.id,
        q.options?.[0] || "Detailed description",
      ]),
    ),
    urgency: "flexible",
    propertyType: "home",
    budgetMin: null,
    budgetMax: null,
  };
  assert.ok(projectSchema.safeParse(input).success);
  assert.equal(
    projectSchema.safeParse({ ...input, placeId: "" }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({ ...input, addressUnit: "a".repeat(101) }).success,
    false,
  );
});
