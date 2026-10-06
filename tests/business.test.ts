import test from "node:test";
import assert from "node:assert/strict";
import { businessDetailsSchema } from "../src/shared/business.js";
import { profileSchema } from "../src/shared/domain.js";
const details = {
  legalName: "Business LLC",
  phone: "+1 212 555 0100",
  email: "office@example.com",
  website: "https://example.com",
  city: "New York",
  state: "NY",
  serviceAreas: "10001",
  specialties: "Home repairs",
  languages: "English",
  hours: "Mon-Fri 9-5 Eastern",
  cancellationPolicy: "24 hours notice",
  yearsExperience: 5,
  teamSize: 2,
  businessType: "LLC",
};

test("simple business details save without legacy questionnaire answers", () => {
  const minimal = { phone: "+1 212 555 0100", email: "office@example.com" };
  const parsed = profileSchema.parse({
    business: "Home repairs",
    category: "Handyman",
    bio: "Local home repairs and maintenance.",
    placeId: "google-place-id",
    address: "350 Fifth Avenue, New York, NY",
    rate: 50,
    serviceRadiusMiles: 25,
    available: true,
    availability: [],
    details: minimal,
  });
  assert.equal(parsed.details.phone, minimal.phone);
  assert.equal(parsed.details.yearsExperience, undefined);
  assert.equal(parsed.details.teamSize, undefined);
  assert.equal(parsed.details.legalName, "");
  assert.equal(parsed.details.hours, "");
  assert.equal(
    businessDetailsSchema.safeParse({ email: minimal.email }).success,
    false,
  );
  assert.equal(
    businessDetailsSchema.safeParse({ phone: minimal.phone }).success,
    false,
  );
  const updated = businessDetailsSchema.parse({
    ...details,
    ...minimal,
    phone: "+1 212 555 0199",
  });
  assert.equal(updated.legalName, details.legalName);
  assert.equal(updated.cancellationPolicy, details.cancellationPolicy);
  assert.equal(updated.yearsExperience, details.yearsExperience);
});
test("business profiles validate contact data and reject client supplied verification", () => {
  assert.equal(businessDetailsSchema.safeParse(details).success, true);
  assert.equal(
    businessDetailsSchema.safeParse({ ...details, email: "invalid" }).success,
    false,
  );
  assert.equal(
    businessDetailsSchema.safeParse({
      ...details,
      website: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    businessDetailsSchema.safeParse({ ...details, verified: true }).success,
    false,
  );
  assert.equal(
    businessDetailsSchema.safeParse({ ...details, teamSize: -1 }).success,
    false,
  );
});
