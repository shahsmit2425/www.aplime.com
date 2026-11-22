import { ProjectDialog } from "./project-dialog.js";
import { T } from "../shared/language.js";
import { useEffect, useState, type ReactNode } from "react";
import {
  Play,
  Pause,
  CheckCircle2,
  Archive,
  RotateCcw,
  XCircle,
  Trash2,
  ShieldAlert,
  Pencil,
} from "lucide-react";
import {
  allowedTransition,
  closedProject,
  type Project,
  type ProjectAction,
} from "../shared/domain.js";
import { request } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Form, Field } from "./ui.js";

const descriptions = {
  start: ["Start work", "Both participants will receive an update."],
  complete: [
    "Request completion",
    "The other participant must confirm before the project is completed.",
  ],
  confirm_completion: [
    "Confirm completion",
    "The customer can then leave a review.",
  ],
  reject_completion: [
    "Request more work",
    "Explain what still needs attention. The project remains in progress.",
  ],
  pause: [
    "Pause project",
    "New estimates and work actions stop. Chats and confirmed appointments stay. Only you can resume.",
  ],
  resume: [
    "Resume project",
    "The other participant is notified. Check your appointment time before work resumes.",
  ],
  cancel: [
    "Cancel project",
    "Immediate before work starts. After work starts, the other participant must agree.",
  ],
  delete: [
    "Remove project",
    "Cancels and archives this request. Professionals involved are notified; history is kept.",
  ],
  archive: [
    "Archive project",
    "It stays accessible from your dashboard. The other participant's records are unaffected.",
  ],
  restore: [
    "Restore to my list",
    "Remove the archived label without reopening or changing this project's status.",
  ],
  dispute: [
    "Report an issue",
    "Describe the problem for support. Work actions pause until the case is resolved.",
  ],
} as const;
type Intent = keyof typeof descriptions;
const needsReason = new Set<Intent>([
  "pause",
  "cancel",
  "delete",
  "dispute",
  "reject_completion",
]);
type Activity = {
  id: string;
  summary: string;
  reason: string | null;
  created_at: string;
  actor_name: string;
};
export function ProjectControls({
  project: p,
  onEdit,
  extraActions,
  hideActivity = false,
  iconOnly = false,
}: {
  project: Project;
  onEdit?: () => void;
  extraActions?: ReactNode;
  hideActivity?: boolean;
  iconOnly?: boolean;
}) {
  const { data, run, busy } = useWorkspace();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [cancellationAction, setCancellationAction] = useState<{
    title: string;
    body: object;
  } | null>(null);
  const allowed = (type: ProjectAction["type"]) =>
    allowedTransition(p, data.user, type);
  const underway =
    p.status === "in_progress" ||
    (p.status === "paused" && p.pausedFrom === "in_progress");
  const outcomes: Partial<Record<ProjectAction["type"], string>> = {
    start: "Work started.",
    complete: "Completion requested. Waiting for the other participant.",
    confirm_completion: "Project completed.",
    reject_completion: "Sent back for more work.",
    pause: "Project paused.",
    resume: "Project resumed.",
    cancel: underway
      ? "Cancellation requested. The other participant must agree."
      : "Project cancelled.",
    delete: underway
      ? "Cancellation requested. The other participant must agree."
      : "Project removed.",
    respond_cancellation: "Your response was sent.",
    withdraw_cancellation: "Cancellation request withdrawn.",
    archive: "Project archived.",
    restore: "Project restored.",
    dispute: "Issue reported. Our team will review it.",
  };
  const submit = (body: unknown) =>
    run(
      async () => {
        await request("/projects/" + p.id + "/actions", {
          ...(body as object),
          expectedVersion: p.version,
        });
        setIntent(null);
        setCancellationAction(null);
      },
      outcomes[(body as { type: ProjectAction["type"] }).type] ||
        "Project updated.",
    );
  useEffect(() => {
    setIntent(null);
    setCancellationAction(null);
  }, [p.id, p.version]);
  const icons = {
    start: Play,
    complete: CheckCircle2,
    pause: Pause,
    resume: Play,
    cancel: XCircle,
    delete: Trash2,
    archive: Archive,
    restore: RotateCcw,
    dispute: ShieldAlert,
  };
  return (
    <>
      <Panel title="Manage this project">
        {p.archived && (
          <p className="project-state-note">Archived for you only.</p>
        )}
        {p.status === "paused" && (
          <div className="project-state-note">
            <h3>Project paused</h3>
            <p>{p.pauseReason}</p>
            <p>
              {p.pausedBy === data.user.id
                ? "You can resume this project when ready."
                : "Only the participant who paused it can resume. Use chat or contact support."}
            </p>
          </div>
        )}
        {p.completionRequested && p.status === "in_progress" && (
          <div className="project-state-note">
            <h3>Completion awaiting confirmation</h3>
            <p>
              {p.completionRequestedBy === data.user.id
                ? "You requested completion. Waiting for the other participant."
                : "Review the work, then confirm or request more work."}
            </p>
            {allowed("confirm_completion") && (
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() => setIntent("confirm_completion")}
                >
                  Confirm completion
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setIntent("reject_completion")}
                >
                  Request more work
                </button>
              </div>
            )}
          </div>
        )}
        {p.cancellationRequestedBy && (
          <div className="project-state-note">
            <h3>Cancellation awaiting agreement</h3>
            <p>{p.cancellationReason}</p>
            <p>
              Other project actions are on hold while you agree on cancellation.
            </p>
            <div className="actions">
              {allowed("respond_cancellation") && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      setCancellationAction({
                        title: "Agree to cancellation",
                        body: {
                          type: "respond_cancellation",
                          requestId: p.cancellationRequestId,
                          accept: true,
                        },
                      })
                    }
                  >
                    Agree to cancellation
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      setCancellationAction({
                        title: "Keep project open",
                        body: {
                          type: "respond_cancellation",
                          requestId: p.cancellationRequestId,
                          accept: false,
                        },
                      })
                    }
                  >
                    Keep project open
                  </button>
                </>
              )}
              {allowed("withdraw_cancellation") && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    setCancellationAction({
                      title: "Withdraw cancellation request",
                      body: { type: "withdraw_cancellation" },
                    })
                  }
                >
                  Withdraw my cancellation request
                </button>
              )}
            </div>
          </div>
        )}
        <div className="actions">
          {onEdit &&
            p.customerId === data.user.id &&
            !closedProject(p.status) && (
              <button
                className="secondary"
                disabled={busy}
                onClick={onEdit}
                title="Edit details"
                aria-label="Edit details"
              >
                <Pencil size={17} />{" "}
                <span className={iconOnly ? "sr-only" : undefined}>
                  <T>{"Edit details"}</T>
                </span>
              </button>
            )}
          {(Object.keys(icons) as (keyof typeof icons)[])
            .filter(
              (type) =>
                type !== "dispute" &&
                allowed(type) &&
                !(type === "archive" && p.archived) &&
                !(type === "restore" && !p.archived),
            )
            .map((type) => {
              const Icon = icons[type];
              return (
                <button
                  key={type}
                  title={descriptions[type][0]}
                  aria-label={descriptions[type][0]}
                  className={
                    type === "start" || type === "complete" ? "" : "secondary"
                  }
                  disabled={busy}
                  onClick={() => setIntent(type)}
                >
                  <Icon size={17} />
                  <span className={iconOnly ? "sr-only" : undefined}>
                    {descriptions[type][0]}
                  </span>
                </button>
              );
            })}
        </div>
        {extraActions}
        {cancellationAction && (
          <ProjectDialog
            title={cancellationAction.title}
            busy={busy}
            onClose={() => setCancellationAction(null)}
          >
            <p>The other participant will be notified.</p>
            <button
              disabled={busy}
              onClick={() => void submit(cancellationAction.body)}
            >
              Confirm
            </button>
          </ProjectDialog>
        )}
        {intent && (
          <ProjectDialog
            title={descriptions[intent][0]}
            busy={busy}
            onClose={() => setIntent(null)}
          >
            <Form
              busy={busy}
              onSubmit={(f) =>
                submit({
                  type: intent,
                  ...(needsReason.has(intent)
                    ? { reason: f.get("reason") }
                    : {}),
                })
              }
            >
              <h3>{descriptions[intent][0]}</h3>
              <p>{descriptions[intent][1]}</p>
              {needsReason.has(intent) && (
                <Field label="Reason">
                  <textarea
                    name="reason"
                    required
                    maxLength={intent === "dispute" ? 2000 : 1000}
                  />
                </Field>
              )}
              <div className="actions">
                <button disabled={busy}>
                  <T>{"Confirm"}</T> {descriptions[intent][0].toLowerCase()}
                </button>
                <button
                  disabled={busy}
                  type="button"
                  className="text-button"
                  onClick={() => setIntent(null)}
                >
                  Go back
                </button>
              </div>
            </Form>
          </ProjectDialog>
        )}
      </Panel>
      {!hideActivity && <ProjectActivity project={p} />}
    </>
  );
}

export function ProjectActivity({ project: p }: { project: Project }) {
  const { data } = useWorkspace();
  const [activity, setActivity] = useState<Activity[]>([]),
    [problem, setProblem] = useState("");
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const rows = await request<Activity[]>(
          "/projects/" + p.id + "/activity",
        );
        if (active) {
          setActivity(rows);
          setProblem("");
        }
      } catch (error) {
        if (active)
          setProblem(
            error instanceof Error ? error.message : "Could not load activity.",
          );
      } finally {
        pending = false;
      }
    };
    void load();
    window.addEventListener("aplime:updates", load);
    window.addEventListener("aplime:meetings", load);
    return () => {
      active = false;
      window.removeEventListener("aplime:updates", load);
      window.removeEventListener("aplime:meetings", load);
    };
  }, [p.id, p.version, data.user.id]);
  return (
    <Panel title="Project activity">
      {problem ? (
        <p role="status">{problem}</p>
      ) : activity.length ? (
        <ol className="project-activity">
          {activity.map((event) => (
            <li key={event.id}>
              <strong>{event.summary}</strong>
              <small>
                {event.actor_name} ·{" "}
                {new Date(event.created_at).toLocaleString()}
              </small>
              {event.reason && <p>{event.reason}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p>New project actions will appear here.</p>
      )}
    </Panel>
  );
}
