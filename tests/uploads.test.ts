import test from "node:test";
import assert from "node:assert/strict";
import {
  imageError,
  uploadSchema,
  MAX_UPLOAD_BYTES,
} from "../src/shared/uploads.js";
test("project images reject unsupported, empty, oversized and excessively named files", () => {
  const valid = {
    name: "kitchen.jpg",
    type: "image/jpeg",
    size: MAX_UPLOAD_BYTES,
  };
  assert.equal(imageError(valid), null);
  for (const change of [
    { type: "image/svg+xml" },
    { type: "application/pdf" },
    { size: 0 },
    { size: MAX_UPLOAD_BYTES + 1 },
    { name: "a".repeat(161) },
  ])
    assert.ok(imageError({ ...valid, ...change }));
  assert.ok(
    uploadSchema.safeParse({
      name: valid.name,
      contentType: valid.type,
      size: valid.size,
    }).success,
  );
  assert.equal(
    uploadSchema.safeParse({
      name: valid.name,
      contentType: valid.type,
      size: MAX_UPLOAD_BYTES + 1,
    }).success,
    false,
  );
});
