import {
  INTAKE_KEY,
  INTAKE_RESUME,
  parseIntakeSession,
} from "./project-intake-state.js";
import { saveIntakePhotos } from "./intake-photo-storage.js";
import { useState } from "react";
import { Plus, FilePenLine, Trash2 } from "lucide-react";
import { request } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Head, Empty } from "./ui.js";
import { ProjectCard } from "./marketplace-cards.js";
export function CustomerDashboard() {
  const { data, go, run, busy } = useWorkspace();
  const [tab, setTab] = useState("active");
  const [discard, setDiscard] = useState(false);
  const draft = data.projectDraft;
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
      {draft && (
        <section className="dashboard-draft" aria-label="Saved project draft">
          <div className="dashboard-draft-icon">
            <FilePenLine size={26} />
          </div>
          <div className="dashboard-draft-copy">
            <span className="dashboard-draft-label">
              Saved draft · Not submitted
            </span>
            <h2>
              {(typeof draft.payload.title === "string" &&
                draft.payload.title.trim()) ||
                "Untitled project"}
            </h2>
            <p>
              {typeof draft.payload.category === "string"
                ? draft.payload.category + " · "
                : ""}
              Saved {new Date(draft.updatedAt).toLocaleString()}. Only you can
              see this draft.
            </p>
          </div>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => go("projects", "draft")}
            >
              Continue draft
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDiscard(true)}
            >
              <Trash2 size={17} /> Discard
            </button>
          </div>
          {discard && (
            <div
              className="dashboard-draft-confirm"
              role="group"
              aria-label="Discard saved draft"
            >
              <p>
                Discard this unpublished draft? Your submitted projects will
                stay in place.
              </p>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await request(
                        "/project-draft",
                        { updatedAt: draft.updatedAt },
                        "DELETE",
                      );
                      try {
                        const local = parseIntakeSession(
                          sessionStorage.getItem(INTAKE_KEY),
                          data.user.id,
                        );
                        if (local?.draftUpdatedAt === draft.updatedAt) {
                          sessionStorage.removeItem(INTAKE_KEY);
                          sessionStorage.removeItem(INTAKE_RESUME);
                          await saveIntakePhotos(local.photoKey, []).catch(
                            () => {},
                          );
                        }
                      } catch {}
                      setDiscard(false);
                    }, "Draft discarded.")
                  }
                >
                  Discard draft
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDiscard(false)}
                >
                  Keep draft
                </button>
              </div>
            </div>
          )}
        </section>
      )}
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
              : draft
                ? "No submitted projects yet."
                : "Start your first project."
          }
        >
          <button onClick={() => go("projects", "new")}>Post a project</button>
        </Empty>
      )}
    </section>
  );
}
