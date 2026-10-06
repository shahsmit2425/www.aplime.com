import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  CheckCircle2,
  Archive,
  RotateCcw,
  XCircle,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import {
  allowedTransition,
  type Project,
  type ProjectAction,
} from "../shared/domain.js";
import { request } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Form, Field } from "./ui.js";

const descriptions = {
  start: [
    "Start work",
    "Confirm that work has started. Both participants will receive an update.",
  ],
  complete: [
    "Request completion",
    "Confirm you believe the work is finished. The other participant must confirm before the project is completed.",
  ],
  confirm_completion: [
    "Confirm completion",
    "Confirm that the agreed work is finished. The customer can then leave a review.",
  ],
  reject_completion: [
    "Request more work",
    "Explain what still needs attention. The project remains in progress.",
  ],
  pause: [
    "Pause project",
    "Explain why you need to pause. New estimates and work actions stop. Existing conversations remain open, and confirmed appointment times stay reserved. Only you can resume this pause.",
  ],
  resume: [
    "Resume project",
    "Return to the previous project stage and notify the other participant. Check your appointment time before work resumes.",
  ],
  cancel: [
    "Cancel project",
    "Before work starts, cancellation takes effect immediately. After work starts, the other participant must agree. Existing records are retained.",
  ],
  delete: [
    "Remove project",
    "Cancel this unassigned request and archive it from your list. Interested professionals will be notified; conversation and support history remain available.",
  ],
  archive: [
    "Archive project",
    "Move this project to your Archived list. The other participant's records are unaffected.",
  ],
  restore: [
    "Restore to my list",
    "Return this project to your project list without reopening or changing its status.",
  ],
  dispute: [
    "Get help",
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
export function ProjectControls({ project: p }: { project: Project }) {
  const { data, run, busy } = useWorkspace();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]),
    [problem, setProblem] = useState("");
  const allowed = (type: ProjectAction["type"]) =>
    allowedTransition(p, data.user, type);
  const underway =
    p.status === "in_progress" ||
    (p.status === "paused" && p.pausedFrom === "in_progress");
  const outcomes: Partial<Record<ProjectAction["type"], string>> = {
    start: "Work started.",
    complete:
      "Completion requested. The other participant will be asked to confirm.",
    confirm_completion: "Project completed.",
    reject_completion: "Sent back for more work.",
    pause: "Project paused.",
    resume: "Project resumed.",
    cancel: underway
      ? "Cancellation requested. The other participant must agree before the project closes."
      : "Project cancelled.",
    delete: underway
      ? "Cancellation requested. The other participant must agree before the project closes."
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
      },
      outcomes[(body as { type: ProjectAction["type"] }).type] ||
        "Project updated.",
    );
  useEffect(() => {
    setIntent(null);
  }, [p.id, p.version]);
  useEffect(() => {
    let active = true;
    void request<Activity[]>("/projects/" + p.id + "/activity")
      .then((rows) => {
        if (active) {
          setActivity(rows);
          setProblem("");
        }
      })
      .catch((error) => {
        if (active) setProblem(error.message);
      });
    return () => {
      active = false;
    };
  }, [p.id, p.version, data.user.id]);
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
          <p className="project-state-note">
            Archived for you. The other participant retains their project
            record.
          </p>
        )}
        {p.status === "paused" && (
          <div className="project-state-note">
            <h3>Project paused</h3>
            <p>{p.pauseReason}</p>
            <p>
              {p.pausedBy === data.user.id
                ? "You can resume this project when ready."
                : "The participant who paused this project must resume it. Use chat to agree on the next step, or contact support."}
            </p>
          </div>
        )}
        {p.completionRequested && p.status === "in_progress" && (
          <div className="project-state-note">
            <h3>Completion awaiting confirmation</h3>
            <p>
              {p.completionRequestedBy === data.user.id
                ? "You requested completion. Waiting for the other participant."
                : "Review the work, then confirm completion or explain what still needs attention."}
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
              Chat and support remain available.
            </p>
            <div className="actions">
              {allowed("respond_cancellation") && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void submit({
                        type: "respond_cancellation",
                        requestId: p.cancellationRequestId,
                        accept: true,
                      })
                    }
                  >
                    Agree to cancellation
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void submit({
                        type: "respond_cancellation",
                        requestId: p.cancellationRequestId,
                        accept: false,
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
                  onClick={() => void submit({ type: "withdraw_cancellation" })}
                >
                  Withdraw my cancellation request
                </button>
              )}
            </div>
          </div>
        )}
        <div className="actions">
          {(Object.keys(icons) as (keyof typeof icons)[])
            .filter(
              (type) =>
                allowed(type) &&
                !(type === "archive" && p.archived) &&
                !(type === "restore" && !p.archived),
            )
            .map((type) => {
              const Icon = icons[type];
              return (
                <button
                  key={type}
                  className={
                    type === "start" || type === "complete" ? "" : "secondary"
                  }
                  disabled={busy}
                  onClick={() => setIntent(type)}
                >
                  <Icon size={17} />
                  {descriptions[type][0]}
                </button>
              );
            })}
        </div>
        {intent && (
          <Form
            busy={busy}
            onSubmit={(f) =>
              submit({
                type: intent,
                ...(needsReason.has(intent) ? { reason: f.get("reason") } : {}),
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
                  minLength={intent === "dispute" ? 10 : 5}
                  maxLength={intent === "dispute" ? 2000 : 1000}
                />
              </Field>
            )}
            <div className="actions">
              <button disabled={busy}>
                Confirm {descriptions[intent][0].toLowerCase()}
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
        )}
      </Panel>
      <Panel title="Project activity">
        <p>
          Important project decisions, with the person who made each update.
        </p>
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
    </>
  );
}
