import type { Project, Quote } from "./domain.js";

// Dashboard sort choices for professionals: by date, or one scenario first.
export const projectSorts = [
  ["recent", "Newest first"],
  ["oldest", "Oldest first"],
  ["open", "Open requests first"],
  ["estimate_sent", "Estimate sent first"],
  ["pending", "Pending your confirmation first"],
  ["scheduled", "Scheduled first"],
  ["in_progress", "In progress first"],
  ["paused", "On hold first"],
  ["completed", "Completed first"],
  ["cancelled", "Cancelled first"],
  ["disputed", "Under review first"],
  ["archived", "Archived first"],
] as const;
export type ProjectSort = (typeof projectSorts)[number][0];
export type ProjectScenario = Exclude<ProjectSort, "recent" | "oldest">;

export function projectScenario(
  p: Project,
  estimates: Quote[],
): ProjectScenario {
  if (p.archived) return "archived";
  if (p.status === "booked")
    return p.awardAccepted === false ? "pending" : "scheduled";
  if (p.status === "requested" || p.status === "quoted")
    return estimates.some((q) => q.projectId === p.id && q.status === "pending")
      ? "estimate_sent"
      : "open";
  return p.status;
}
const created = (p: Project) => Date.parse(p.createdAt) || 0;
// Scenario sorts put that scenario first; everything else stays newest first.
export function sortProjects(
  projects: Project[],
  sort: ProjectSort,
  estimates: Quote[],
) {
  return [...projects].sort((a, b) =>
    sort === "oldest"
      ? created(a) - created(b)
      : Number(projectScenario(b, estimates) === sort) -
          Number(projectScenario(a, estimates) === sort) ||
        created(b) - created(a),
  );
}
