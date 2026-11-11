import { T } from "../shared/language.js";
import { useEffect, useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Project, Upload } from "../shared/domain.js";
import { money } from "../shared/domain.js";
import {
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { request } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Badge } from "./ui.js";
import { ProjectPhotoGallery } from "./project-photo-gallery.js";
export function ProjectQuickView({
  conversationId,
  projectId,
  onClose,
}: {
  conversationId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { go, data } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{
    project: Project;
    files: Upload[];
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    void request<{ project: Project; files: Upload[] }>(
      `/discussions/${conversationId}/projects/${projectId}`,
    )
      .then((r) => {
        if (active) setResult(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [conversationId, projectId, attempt]);
  const p = result?.project;
  const canOpen =
    data.projects.some((project) => project.id === projectId) ||
    data.leads.some((project) => project.id === projectId);
  return (
    <dialog
      ref={dialog}
      className="project-quick-view"
      aria-labelledby="project-quick-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2 id="project-quick-title">
          <T>{"Project details"}</T>
        </h2>
        <button
          type="button"
          className="secondary"
          aria-label="Close project details"
          autoFocus
          onClick={onClose}
        >
          <X size={18} /> <T>{"Close"}</T>{" "}
        </button>
      </header>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>
            <T>{"Retry"}</T>
          </button>
        </div>
      ) : !p ? (
        <p role="status">Loading project…</p>
      ) : (
        <>
          <div className="project-quick-title">
            <h3>{p.title}</h3>
            <Badge>{p.status.replaceAll("_", " ")}</Badge>
          </div>
          <p>{p.description}</p>
          <dl className="project-quick-facts">
            <div>
              <dt>
                <T>{"Service"}</T>
              </dt>
              <dd>{p.category}</dd>
            </div>
            <div>
              <dt>
                <T>{"Customer"}</T>
              </dt>
              <dd>{p.customerName}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {[p.address, p.addressUnit].filter(Boolean).join(" ") || p.zip}
              </dd>
            </div>
            <div>
              <dt>
                <T>{"Timing"}</T>
              </dt>
              <dd>{p.urgency.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>
                <T>{"Appointment"}</T>
              </dt>
              <dd>
                {p.scheduledAt
                  ? new Date(p.scheduledAt).toLocaleString()
                  : "Not scheduled"}
              </dd>
            </div>
            <div>
              <dt>
                <T>{"Budget"}</T>
              </dt>
              <dd>
                {p.budgetMin != null || p.budgetMax != null
                  ? [p.budgetMin, p.budgetMax]
                      .map((n) => (n == null ? "Open" : money(n)))
                      .join(" – ")
                  : "Not specified"}
              </dd>
            </div>
            {Object.entries(p.intake || {}).map(([key, value]) => (
              <div key={key}>
                <dt>{questionLabel(p.category as ServiceCategory, key)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <ProjectPhotoGallery files={result!.files} />
          {canOpen && (
            <button
              className="secondary"
              onClick={() => {
                onClose();
                go("project", p.id);
              }}
            >
              <ExternalLink size={16} /> Open full project
            </button>
          )}
        </>
      )}
    </dialog>
  );
}
