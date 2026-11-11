import { inProjectGroup } from "./project-hub.js";
import { statuses, type Project } from "../shared/domain.js";
import { T } from "../shared/language.js";
import { useState } from "react";
import { quotePrice, quoteTiming } from "../shared/estimates.js";
import { SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { Head, Empty, Badge } from "./ui.js";
import { CollectionHeading, ProjectCard } from "./marketplace-cards.js";
import { SetupNotice } from "./setup-notice.js";

export function ProDashboard() {
  const { data, go } = useWorkspace();
  const [status, setStatus] = useState("");
  const archived = status === "archived";
  const matchesStatus = (p: Project) =>
    archived ? !!p.archived : !p.archived && (!status || p.status === status);
  const assigned = [...new Map(data.projects.map((p) => [p.id, p])).values()];
  const projectIds = new Set(assigned.map((p) => p.id));
  const availableMatches = [
    ...new Map(data.leads.map((p) => [p.id, p])).values(),
  ].filter((p) => !projectIds.has(p.id));
  const projects = assigned.filter(matchesStatus);
  const active = projects
    .filter((p) => inProjectGroup(p, "active"))
    .sort(
      (a, b) =>
        Number(b.status === "booked" && b.awardAccepted === false) -
        Number(a.status === "booked" && a.awardAccepted === false),
    );
  const groups = archived
    ? [{ title: "Archived projects", projects }]
    : [
        { title: "Active projects", projects: active },
        {
          title:
            data.discoveryMode === "open"
              ? "Available projects"
              : "Matched projects",
          projects: availableMatches.filter(matchesStatus),
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
      ];
  const total = groups.reduce((n, group) => n + group.projects.length, 0);
  const allProjects = [...data.projects, ...availableMatches];
  const estimates = data.quotes.filter((q) => q.proId === data.user.id);
  return (
    <section className="pro-dashboard" aria-label="Professional dashboard">
      <Head
        title={<T>{"Dashboard"}</T>}
        action={
          <button className="secondary" onClick={() => go("availability")}>
            <SlidersHorizontal size={18} /> <T>{"Project preferences"}</T>{" "}
          </button>
        }
      >
        Your matches, jobs, and estimates in one place.
      </Head>
      {!!data.discoveryRequirements?.length && (
        <SetupNotice
          requirements={data.discoveryRequirements}
          onContinue={() => go("profile")}
        />
      )}
      <div className="pro-dashboard-filters" aria-label="Project filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {(
                  {
                    requested: "Open request",
                    quoted: "Reviewing estimates",
                    in_progress: "In progress",
                  } as Record<string, string>
                )[value] || value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
            <option value="archived">Archived</option>
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
            className="project-collection"
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
                  onOpen={() => go("project", p.id)}
                />
              ))}
            </div>
          </section>
        ))}
      {!total && (
        <Empty
          title={
            status
              ? "No projects with this status."
              : "No current projects yet."
          }
        />
      )}
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
                    <small>
                      This project is no longer available. Your estimate is kept
                      for your records.
                    </small>
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
