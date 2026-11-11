import type { Profile, Project, Quote } from "../shared/domain.js";
export const projectGroups = [
  "all",
  "active",
  "paused",
  "completed",
  "cancelled",
  "archived",
] as const;
export type ProjectGroup = (typeof projectGroups)[number];
export function inProjectGroup(p: Project, group: ProjectGroup) {
  if (group === "all") return true;
  if (group === "archived") return !!p.archived;
  if (p.archived) return false;
  if (group === "active")
    return [
      "requested",
      "quoted",
      "booked",
      "in_progress",
      "disputed",
    ].includes(p.status);
  return p.status === group;
}
export function projectProfessionals(
  p: Project,
  profiles: Profile[],
  quotes: Quote[],
  openDiscovery: boolean,
) {
  const open = !p.proId && ["requested", "quoted"].includes(p.status);
  const quoted = new Set(
    quotes.filter((q) => q.projectId === p.id).map((q) => q.proId),
  );
  return profiles.filter(
    (f) =>
      f.id === p.proId ||
      quoted.has(f.id) ||
      (open &&
        (openDiscovery ? f.discoverable : f.matchedProjectIds?.includes(p.id))),
  );
}
export function estimateCanBeAccepted(p: Project, q: Quote, now = Date.now()) {
  return (
    q.projectId === p.id &&
    !q.assessmentRequired &&
    typeof q.amount === "number" &&
    q.amount > 0 &&
    q.status === "pending" &&
    ["requested", "quoted"].includes(p.status) &&
    (!q.expiresAt || Date.parse(q.expiresAt) > now)
  );
}
