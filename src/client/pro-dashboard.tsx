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
  const projects = [
    ...new Map(
      data.projects
        .filter((p) => !!p.archived === archived)
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const projectIds = new Set(data.projects.map((p) => p.id));
  const matches = [
    ...new Map(data.leads.map((p) => [p.id, p])).values(),
  ].filter((p) => !projectIds.has(p.id));
  const allProjects = [...data.projects, ...matches];
  const estimates = data.quotes.filter((q) => q.proId === data.user.id);
  return (
    <section className="pro-dashboard" aria-label="Professional dashboard">
      <Head
        title="Dashboard"
        action={
          <button className="secondary" onClick={() => go("availability")}>
            <SlidersHorizontal size={18} /> Project preferences
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
          <Empty title="No new projects yet.">
            New opportunities appear here as customers post requests. Manage
            your service areas and categories in Project preferences.
          </Empty>
        )}
      </section>
      {estimates.length > 0 && (
        <details className="pro-estimate-history">
          <summary>
            Estimate history <span>{estimates.length}</span>
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
