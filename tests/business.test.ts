import test from "node:test";
import assert from "node:assert/strict";
import { businessDetailsSchema } from "../src/shared/business.js";
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
