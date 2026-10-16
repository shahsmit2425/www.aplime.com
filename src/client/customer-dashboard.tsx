import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { Head, Empty } from "./ui.js";
import { ProjectCard } from "./marketplace-cards.js";
export function CustomerDashboard() {
  const { data, go } = useWorkspace();
  const [tab, setTab] = useState("active");
  const owned = data.projects.filter((p) => p.customerId === data.user.id);
  const projects = owned.filter((p) =>
    tab === "archived"
      ? p.archived
      : !p.archived &&
        (tab === "all" ||
          (tab === "completed"
            ? ["completed", "cancelled"].includes(p.status)
            : !["completed", "cancelled"].includes(p.status))),
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
      <nav className="actions" aria-label="Project status">
        {["active", "completed", "archived", "all"].map((value) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "" : "secondary"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </nav>
      {projects.length ? (
        <div className="project-card-grid">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              quotes={data.quotes}
              onOpen={() => go("project", p.id)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title={
            owned.length
              ? "No projects in this view."
              : "Start your first project."
          }
        >
          <button onClick={() => go("projects", "new")}>Post a project</button>
        </Empty>
      )}
    </section>
  );
}
