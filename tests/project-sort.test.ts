import test from "node:test";
import assert from "node:assert/strict";
import type { Project, Quote } from "../src/shared/domain.js";
import {
  projectScenario,
  projectSorts,
  sortProjects,
} from "../src/shared/project-sort.js";

const project = (id: string, day: number, extra: Partial<Project> = {}) =>
  ({
    id,
    status: "requested",
    createdAt: new Date(Date.UTC(2026, 0, day)).toISOString(),
    ...extra,
  }) as Project;
const estimates = [
  { projectId: "sent", status: "pending" },
  { projectId: "withdrawn", status: "withdrawn" },
] as Quote[];
const projects = [
  project("open", 1),
  project("sent", 2, { status: "quoted" }),
  project("withdrawn", 3, { status: "quoted" }),
  project("pending", 4, { status: "booked", awardAccepted: false }),
  project("scheduled", 5, { status: "booked", awardAccepted: true }),
  project("working", 6, { status: "in_progress" }),
  project("paused", 7, { status: "paused" }),
  project("done", 8, { status: "completed" }),
  project("cancelled", 9, { status: "cancelled" }),
  project("disputed", 10, { status: "disputed" }),
  project("archived", 11, { status: "completed", archived: true }),
];
const ids = (list: Project[]) => list.map((p) => p.id);

test("each project falls into one sortable scenario", () => {
  assert.deepEqual(
    projects.map((p) => projectScenario(p, estimates)),
    [
      "open",
      "estimate_sent",
      "open",
      "pending",
      "scheduled",
      "in_progress",
      "paused",
      "completed",
      "cancelled",
      "disputed",
      "archived",
    ],
  );
});

test("date sorts order by creation date", () => {
  assert.equal(ids(sortProjects(projects, "recent", estimates))[0], "archived");
  assert.deepEqual(
    ids(sortProjects(projects, "oldest", estimates)),
    ids(projects),
  );
});

test("every scenario sort leads with its projects, then newest first", () => {
  for (const [sort] of projectSorts.slice(2)) {
    const sorted = sortProjects(projects, sort, estimates);
    const matching = projects.filter(
      (p) => projectScenario(p, estimates) === sort,
    );
    assert.ok(matching.length, sort);
    assert.deepEqual(
      ids(sorted.slice(0, matching.length)).sort(),
      ids(matching).sort(),
    );
    const rest = sorted.slice(matching.length).map((p) => p.createdAt);
    assert.deepEqual(rest, [...rest].sort().reverse());
  }
  assert.deepEqual(ids(sortProjects(projects, "open", estimates)).slice(0, 2), [
    "withdrawn",
    "open",
  ]);
});
