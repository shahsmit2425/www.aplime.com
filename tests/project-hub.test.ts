import test from "node:test";
import assert from "node:assert/strict";
import {
  inProjectGroup,
  projectProfessionals,
  estimateCanBeAccepted,
} from "../src/client/project-hub.js";
import type { Profile, Project, Quote } from "../src/shared/domain.js";
const project = { id: "project", proId: null, status: "requested" } as Project;
const quote = {
  id: "quote",
  projectId: "project",
  proId: "quoted",
  status: "pending",
  expiresAt: null,
} as Quote;
test("dashboard separates archived projects from current states without hiding them from All", () => {
  const completed = {
    ...project,
    status: "completed" as const,
    archived: true,
  };
  assert.equal(inProjectGroup(completed, "all"), true);
  assert.equal(inProjectGroup(completed, "archived"), true);
  assert.equal(inProjectGroup(completed, "completed"), false);
  assert.equal(
    inProjectGroup({ ...project, status: "paused" }, "active"),
    false,
  );
  assert.equal(
    inProjectGroup({ ...project, status: "paused" }, "paused"),
    true,
  );
  assert.equal(
    inProjectGroup({ ...project, status: "disputed" }, "active"),
    true,
  );
});
test("project professional cards respect matched scope and retain quote participants", () => {
  const profiles = [
    { id: "match", matchedProjectIds: ["project"] },
    { id: "other", matchedProjectIds: ["another"], discoverable: true },
    { id: "quoted" },
    { id: "hidden", discoverable: false },
  ] as Profile[];
  assert.deepEqual(
    projectProfessionals(project, profiles, [quote], false).map((p) => p.id),
    ["match", "quoted"],
  );
  assert.deepEqual(
    projectProfessionals(project, profiles, [quote], true).map((p) => p.id),
    ["other", "quoted"],
  );
  assert.deepEqual(
    projectProfessionals(
      { ...project, proId: "match", status: "booked" },
      profiles,
      [quote],
      true,
    ).map((p) => p.id),
    ["match", "quoted"],
  );
  assert.deepEqual(
    projectProfessionals(
      { ...project, status: "paused" },
      profiles,
      [quote],
      false,
    ).map((p) => p.id),
    ["quoted"],
  );
});
test("acceptance UI excludes expired, unrelated, non-pending and closed-project estimates", () => {
  assert.equal(estimateCanBeAccepted(project, quote), true);
  for (const status of [
    "paused",
    "booked",
    "in_progress",
    "completed",
    "cancelled",
    "disputed",
  ] as const)
    assert.equal(estimateCanBeAccepted({ ...project, status }, quote), false);
  assert.equal(
    estimateCanBeAccepted(project, { ...quote, projectId: "another" }),
    false,
  );
  assert.equal(
    estimateCanBeAccepted(project, { ...quote, status: "accepted" }),
    false,
  );
  assert.equal(
    estimateCanBeAccepted(
      project,
      { ...quote, expiresAt: "2026-01-01T00:00:00Z" },
      Date.parse("2026-01-01T00:00:00Z"),
    ),
    false,
  );
});
