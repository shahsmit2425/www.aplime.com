import { Plus } from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { Head, Empty } from "./ui.js";
import { ProjectCard } from "./marketplace-cards.js";
export function CustomerDashboard() {
  const { data, go } = useWorkspace();
  const projects = data.projects.filter((p) => p.customerId === data.user.id);
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
        <Empty title="Start your first project.">
          <button onClick={() => go("projects", "new")}>Post a project</button>
        </Empty>
      )}
    </section>
  );
}
