import { categories, statuses, type Project } from "../shared/domain.js";
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
  const [archived, setArchived] = useState(false);
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const matchesFilters = (p: Project) =>
    (!service || p.category === service) &&
    (!status || p.status === status) &&
    (!urgency || p.urgency === urgency);
  const filtered = !!(service || status || urgency);
  const resetFilters = () => {
    setService("");
    setStatus("");
    setUrgency("");
    setArchived(false);
  };
  const projects = [
    ...new Map(
      data.projects
        .filter((p) => !!p.archived === archived && matchesFilters(p))
        .map((p) => [p.id, p]),
    ).values(),
  ];
  projects.sort(
    (a, b) =>
      Number(b.status === "booked" && b.awardAccepted === false) -
      Number(a.status === "booked" && a.awardAccepted === false),
  );
  const projectIds = new Set(data.projects.map((p) => p.id));
  const availableMatches = [
    ...new Map(data.leads.map((p) => [p.id, p])).values(),
  ].filter((p) => !projectIds.has(p.id));
  const matches = archived ? [] : availableMatches.filter(matchesFilters);
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
          Service
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">All services</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
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
          </select>
        </label>
        <label>
          Timing
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">Any timing</option>
            <option value="urgent">As soon as possible</option>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        {(filtered || archived) && (
          <button type="button" className="text-button" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          aria-pressed={archived}
          onClick={() => setArchived(!archived)}
        >
          {archived ? "Show current projects" : "Show archived projects"}
        </button>
      </div>
      <p role="status">{projects.length + matches.length} projects shown</p>
      {archived && !projects.length && (
        <Empty title="No archived projects match these filters." />
      )}
      {projects.length > 0 && (
        <section className="project-collection" aria-label="Your projects">
          <CollectionHeading title="Your projects" count={projects.length} />
          <div className="project-card-grid">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                quotes={estimates}
                onOpen={() => go("project", p.id)}
              />
            ))}
          </div>
        </section>
      )}
      {!archived && (
        <section className="project-collection" aria-label="Matched projects">
          <CollectionHeading
            title={
              data.discoveryMode === "open"
                ? "Available projects"
                : "Matched projects"
            }
            count={matches.length}
          />
          {matches.length ? (
            <div className="project-card-grid">
              {matches.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  quotes={estimates}
                  onOpen={() => go("project", p.id)}
                />
              ))}
            </div>
          ) : (
            <Empty
              title={
                filtered
                  ? "No matches for these filters."
                  : "No new projects yet."
              }
            >
              New opportunities appear here as customers post requests. Manage
              your service areas and categories in Project preferences.
            </Empty>
          )}
        </section>
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
