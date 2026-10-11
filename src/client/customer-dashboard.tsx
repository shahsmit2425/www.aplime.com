import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { Head, Empty } from "./ui.js";
import { ProjectCard } from "./marketplace-cards.js";
import {
  inProjectGroup,
  projectGroups,
  type ProjectGroup,
} from "./project-hub.js";
export function CustomerDashboard() {
  const { data, go } = useWorkspace();
  const [group, setGroup] = useState<ProjectGroup>("all");
  const [query, setQuery] = useState("");
  const projects = data.projects.filter((p) => p.customerId === data.user.id);
  const visible = projects.filter(
    (p) =>
      inProjectGroup(p, group) &&
      [p.title, p.category, p.zip]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="customer-dashboard">
      <Head
        title="Dashboard"
        action={
          <button onClick={() => go("projects", "new")}>
            <Plus size={18} />
            Post a project
          </button>
        }
      />
      <div className="project-dashboard-tools">
        <div
          className="project-filter-tabs"
          role="group"
          aria-label="Filter projects by status"
        >
          {projectGroups.map((key) => (
            <button
              key={key}
              className="secondary"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
            >
              {key === "all"
                ? "All projects"
                : key.charAt(0).toUpperCase() + key.slice(1)}
              <span>
                {projects.filter((p) => inProjectGroup(p, key)).length}
              </span>
            </button>
          ))}
        </div>
        <label className="dashboard-search">
          <Search size={18} />
          <input
            aria-label="Search your projects"
            type="search"
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="sr-only" role="status">
        {visible.length} projects shown
      </p>
      {visible.length ? (
        <div className="project-card-grid">
          {visible.map((p) => (
            <div className="dashboard-project" key={p.id}>
              <ProjectCard project={p} onOpen={() => go("project", p.id)} />
              <div className="dashboard-project-updates">
                <span>
                  {
                    data.quotes.filter(
                      (q) => q.projectId === p.id && q.status === "pending",
                    ).length
                  }{" "}
                  pending estimates
                </span>
                {p.archived && <strong>Archived</strong>}
                {p.completionRequested && <strong>Completion requested</strong>}
                {p.cancellationRequestedBy && (
                  <strong>Cancellation requested</strong>
                )}
                {p.proposedAt && <strong>Appointment proposed</strong>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={
            projects.length
              ? "No projects in this view."
              : "Start your first project."
          }
        >
          {projects.length ? (
            <button
              className="secondary"
              onClick={() => {
                setGroup("all");
                setQuery("");
              }}
            >
              Show all projects
            </button>
          ) : (
            <button onClick={() => go("projects", "new")}>
              Post a project
            </button>
          )}
        </Empty>
      )}
    </section>
  );
}
