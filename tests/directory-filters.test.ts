import test from "node:test";
import assert from "node:assert/strict";
import { filterDirectory } from "../src/client/directory-filters.js";
import type { Profile } from "../src/shared/domain.js";
const profiles = [
  {
    id: "a",
    business: "Oak Painting",
    bio: "Interior walls",
    zip: "08859",
    serviceCategories: ["Painting"],
    verified: true,
    rate: 45.5,
    rating: 4.8,
    reviewCount: 2,
  },
  {
    id: "b",
    business: "Brook Services",
    bio: "Outdoor care",
    zip: "10001",
    serviceCategories: ["Landscaping", "Handyman"],
    verified: false,
    rate: 30,
    rating: 5,
    reviewCount: 0,
  },
] as Profile[];
const defaults = { query: "", category: "", verified: false, sort: "default" };
test("directory filters refine only supplied profiles and combine service, search and identity", () => {
  assert.deepEqual(
    filterDirectory(profiles, {
      ...defaults,
      query: "  WALLS ",
      category: "Painting",
      verified: true,
    }).map((p) => p.id),
    ["a"],
  );
  assert.deepEqual(
    filterDirectory(profiles, { ...defaults, query: "10001", verified: true }),
    [],
  );
  assert.deepEqual(
    filterDirectory(profiles, { ...defaults, category: "Handyman" }).map(
      (p) => p.id,
    ),
    ["b"],
  );
  assert.deepEqual(filterDirectory([], defaults), []);
});
test("directory sorting preserves source order and ranks reviewed businesses before unreviewed", () => {
  assert.deepEqual(
    filterDirectory(profiles, { ...defaults, sort: "rate" }).map((p) => p.id),
    ["b", "a"],
  );
  assert.deepEqual(
    filterDirectory(profiles, { ...defaults, sort: "rating" }).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterDirectory(profiles, defaults).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    profiles.map((p) => p.id),
    ["a", "b"],
  );
});
