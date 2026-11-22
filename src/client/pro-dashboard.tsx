import { inProjectGroup } from "./project-hub.js";
import {
  projectSorts,
  sortProjects,
  type ProjectSort,
} from "../shared/project-sort.js";
import { T } from "../shared/language.js";
import { useState } from "react";
import { quotePrice, quoteTiming } from "../shared/estimates.js";
import {
  SlidersHorizontal,
  ArrowUpRight,
  FileText,
  Clock3,
  Trophy,
  BriefcaseBusiness,
} from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { Head, Empty, Badge } from "./ui.js";
import { CollectionHeading, ProjectCard } from "./marketplace-cards.js";
import { SetupNotice } from "./setup-notice.js";

export function ProDashboard() {
  const { data, go } = useWorkspace();
  const [sort, setSort] = useState<ProjectSort>("recent");
  const estimates = data.quotes.filter((q) => q.proId === data.user.id);
  const assigned = [...new Map(data.projects.map((p) => [p.id, p])).values()];
  const projectIds = new Set(assigned.map((p) => p.id));
  const availableMatches = [
    ...new Map(data.leads.map((p) => [p.id, p])).values(),
  ].filter((p) => !projectIds.has(p.id));
  const byDate = sort === "recent" || sort === "oldest";
  const ordered = (list: typeof assigned) =>
    sortProjects(list, sort, estimates);
  const projects = ordered(assigned.filter((p) => !p.archived));
  // Date sorts keep the sections; a scenario sort is one list led by it.
  const groups = byDate
    ? [
        {
          title: "Active projects",
          projects: projects
            .filter((p) => inProjectGroup(p, "active"))
            .sort(
              (a, b) =>
                Number(b.status === "booked" && b.awardAccepted === false) -
                Number(a.status === "booked" && a.awardAccepted === false),
            ),
        },
        {
          title:
            data.discoveryMode === "open"
              ? "Available projects"
              : "Matched projects",
          projects: ordered(availableMatches.filter((p) => !p.archived)),
        },
        {
          title: "Paused projects",
          projects: projects.filter((p) => p.status === "paused"),
        },
        {
          title: "Past projects",
          projects: projects.filter(
            (p) => p.status === "completed" || p.status === "cancelled",
          ),
        },
      ]
    : [
        {
          title: "Projects",
          // Archived projects only join the list when they lead it.
          projects: ordered(
            [...assigned, ...availableMatches].filter(
              (p) => sort === "archived" || !p.archived,
            ),
          ),
        },
      ];
  const total = groups.reduce((n, group) => n + group.projects.length, 0);
  const allProjects = [...data.projects, ...availableMatches];
  return (
    <section className="pro-dashboard" aria-label="Professional dashboard">
      <Head
        title={<T>{"Dashboard"}</T>}
        action={
          <button className="secondary" onClick={() => go("availability")}>
            <SlidersHorizontal size={18} /> <T>{"Project preferences"}</T>{" "}
          </button>
        }
      />
      {!!data.discoveryRequirements?.length && (
        <SetupNotice
          requirements={data.discoveryRequirements}
          onContinue={() => go("profile")}
        />
      )}
      <div className="dashboard-metrics" aria-label="Project overview">
        {[
          {
            label: "Open requests",
            value: allProjects.filter(
              (p) => !p.archived && p.status === "requested",
            ).length,
            Icon: FileText,
          },
          {
            label: "Reviewing estimates",
            value: allProjects.filter(
              (p) => !p.archived && p.status === "quoted",
            ).length,
            Icon: Clock3,
          },
          {
            label: "Active projects",
            value: assigned.filter(
              (p) => !p.archived && inProjectGroup(p, "active"),
            ).length,
            Icon: BriefcaseBusiness,
          },
          {
            label: "Completed projects",
            value: assigned.filter((p) => p.status === "completed").length,
            Icon: Trophy,
          },
        ].map(({ label, value, Icon }) => (
          <div className="dashboard-metric" key={label}>
            <Icon aria-hidden="true" />
            <span>
              <strong>{value}</strong>
              <small>{label}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="pro-dashboard-filters" aria-label="Project sorting">
        <label>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProjectSort)}
          >
            {projectSorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {total} {total === 1 ? "project" : "projects"} shown
      </p>
      {groups
        .filter((group) => group.projects.length > 0)
        .map((group) => (
          <section
            className={
              "project-collection" +
              (group.title === "Past projects" ? " past-projects" : "")
            }
            aria-label={group.title}
            key={group.title}
          >
            <CollectionHeading
              title={group.title}
              count={group.projects.length}
            />
            <div className="project-card-grid">
              {group.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  quotes={estimates}
                  photo={data.uploads.find(
                    (file) =>
                      file.projectId === p.id &&
                      file.status === "ready" &&
                      file.contentType.startsWith("image/"),
                  )}
                  onOpen={() => go("project", p.id)}
                />
              ))}
            </div>
          </section>
        ))}
      {!total && <Empty title="No current projects yet." />}
      {estimates.length > 0 && (
        <details className="pro-estimate-history">
          <summary>
            <T>{"Estimate history"}</T> <span>{estimates.length}</span>
          </summary>
          <div className="pro-estimate-list">
            {estimates.map((q) => {
              const project = allProjects.find((p) => p.id === q.projectId);
              return (
                <article key={q.id} className="pro-estimate-item">
                  <div className="pro-estimate-heading">
                    <h3>
                      {project?.title || q.projectTitle || "Project estimate"}
                    </h3>
                    <strong>{quotePrice(q)}</strong>
                    <Badge>{q.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p>{q.description}</p>
                  <small>
                    {quoteTiming(q)} · Version {q.revision}
                    {q.expiresAt &&
                      ` · Valid until ${new Date(q.expiresAt).toLocaleDateString()}`}
                  </small>
                  {project ? (
                    <button
                      className="secondary"
                      onClick={() => go("project", project.id)}
                    >
                      Manage in project <ArrowUpRight size={16} />
                    </button>
                  ) : (
                    <small>This project is no longer available.</small>
                  )}
                </article>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
