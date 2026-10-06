import test from "node:test";
import assert from "node:assert/strict";
import {
  businessImageSchema,
  matchesImageSignature,
  hasBusinessBranding,
} from "../src/shared/business-images.js";

test("business review needs exactly the two branding roles, without requiring portfolio photos", () => {
  assert.equal(hasBusinessBranding(["logo", "cover"]), true);
  assert.equal(hasBusinessBranding(["logo", "cover", "work-1"]), true);
  assert.equal(hasBusinessBranding(["logo", "work-1"]), false);
  assert.equal(hasBusinessBranding(["cover", "work-1"]), false);
  assert.equal(hasBusinessBranding(["logo", "logo"]), false);
  assert.equal(hasBusinessBranding([]), false);
});
test("business images allow only bounded image slots and supported image files", () => {
  const valid = {
    slot: "logo",
    name: "logo.png",
    contentType: "image/png",
    size: 1024,
  };
  assert.equal(businessImageSchema.safeParse(valid).success, true);
  for (const extra of [
    { slot: "work-6" },
    { contentType: "image/svg+xml" },
    { size: 0 },
    { size: 10485761 },
    { profileId: "someone-else" },
  ])
    assert.equal(
      businessImageSchema.safeParse({ ...valid, ...extra }).success,
      false,
    );
});
test("business image completion checks file signatures rather than trusting MIME alone", () => {
  assert.equal(
    matchesImageSignature(
      "image/png",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ),
    true,
  );
  assert.equal(
    matchesImageSignature("image/jpeg", new Uint8Array([255, 216, 255])),
    true,
  );
  assert.equal(
    matchesImageSignature(
      "image/webp",
      new TextEncoder().encode("RIFF1234WEBP"),
    ),
    true,
  );
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    assert.equal(
      matchesImageSignature(
        type,
        new TextEncoder().encode("<svg onload=alert(1)>"),
      ),
      false,
    );
  assert.equal(matchesImageSignature("image/png", new Uint8Array()), false);
});
