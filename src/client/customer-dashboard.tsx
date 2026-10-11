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
        <Empty title="Start your first project.">
          <button onClick={() => go("projects", "new")}>Post a project</button>
        </Empty>
      )}
    </section>
  );
}
