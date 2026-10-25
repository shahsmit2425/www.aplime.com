import { T } from "../shared/language.js";
import { useWorkspace } from "./workspace.js";
import { ChatWithPro } from "./project-actions.js";
import { CallScheduler, ScheduleCallButton } from "./call-meetings.js";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, MessageCircle, X } from "lucide-react";
import { request } from "./api.js";
import { discussionRoute, type Discussion } from "../shared/chat.js";
import { callIsActive } from "../shared/meetings.js";
import { useMeetings } from "./meeting-state.js";

// Every marketplace card exposes the same actions; project permissions still
// determine whether chat and scheduling are available.
export function ProfessionalActions({
  proId,
  projectId,
  canContact = true,
  saved = false,
}: {
  proId: string;
  projectId?: string;
  canContact?: boolean;
  saved?: boolean;
}) {
  const { data, go } = useWorkspace();
  if (saved) return <SavedProfessionalActions proId={proId} />;
  const project = [...data.projects, ...data.leads].find(
    (p) => p.id === projectId,
  );
  const canSchedule =
    project &&
    !["completed", "cancelled", "disputed"].includes(project.status) &&
    (!project.proId || project.proId === proId);
  return (
    <>
      {projectId && canContact && (
        <ChatWithPro projectId={projectId} proId={proId} label="Chat" />
      )}
      {projectId && canContact && canSchedule && (
        <ScheduleCallButton projectId={projectId} proId={proId} />
      )}
      <button type="button" onClick={() => go("pro", proId)}>
        <T>{"View profile"}</T>{" "}
      </button>
    </>
  );
}

// Saved profiles have no implicit project: reuse an existing account chat or
// let the customer choose a project only when starting a new interaction.
function SavedProfessionalActions({ proId }: { proId: string }) {
  const { data, go, run, busy } = useWorkspace();
  const { rows, now, loading, error, refresh } = useMeetings();
  const [intent, setIntent] = useState<"chat" | "call" | null>(null);
  const [callProject, setCallProject] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (intent) dialog.current?.showModal();
  }, [intent]);
  const profile = data.profiles.find((p) => p.id === proId);
  const activeMeeting = rows.find(
    (m) =>
      m.proId === proId &&
      m.customerId === data.user.id &&
      callIsActive(m, now),
  );
  const eligible = data.projects.filter(
    (p) =>
      p.customerId === data.user.id &&
      !p.archived &&
      !["completed", "cancelled", "disputed"].includes(p.status) &&
      (p.proId === proId ||
        (!p.proId &&
          ["requested", "quoted"].includes(p.status) &&
          (profile?.matchedProjectIds?.includes(p.id) ||
            (data.discoveryMode === "open" && profile?.discoverable)))),
  );
  const start = (projectId: string) => {
    if (intent === "call") {
      setIntent(null);
      setCallProject(projectId);
    } else
      void run(async () => {
        const thread = await request<{ id: string }>(
          `/projects/${projectId}/discussions/${proId}`,
          {},
        );
        setIntent(null);
        go("messages", discussionRoute(thread.id, projectId));
      }, "");
  };
  return (
    <>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const threads = await request<Discussion[]>("/discussions");
            const thread = threads.find(
              (t) => t.pro_id === proId && t.customer_id === data.user.id,
            );
            if (thread) go("messages", thread.id);
            else setIntent("chat");
          }, "")
        }
      >
        <MessageCircle size={17} /> <T>{"Chat"}</T>{" "}
      </button>
      <button
        className="secondary"
        disabled={busy || loading}
        onClick={() => {
          if (error) void refresh();
          else if (activeMeeting) go("schedule", activeMeeting.id);
          else setIntent("call");
        }}
      >
        <CalendarPlus size={17} />
        {loading
          ? "Loading meeting…"
          : error
            ? "Retry meetings"
            : activeMeeting
              ? "Manage meeting"
              : "Schedule call"}
      </button>
      <button type="button" onClick={() => go("pro", proId)}>
        <T>{"View profile"}</T>{" "}
      </button>
      {intent && (
        <dialog
          ref={dialog}
          className="call-scheduler saved-pro-project-picker"
          aria-labelledby="saved-project-title"
          onCancel={() => setIntent(null)}
          onClose={() => setIntent(null)}
        >
          <header>
            <h2 id="saved-project-title">Choose a project</h2>
            <button
              className="secondary"
              aria-label="Close project chooser"
              onClick={() => setIntent(null)}
            >
              <X size={18} />
            </button>
          </header>
          <p>
            {profile?.business} ·{" "}
            {intent === "call" ? "Schedule a call" : "Start a conversation"}
          </p>
          {eligible.length ? (
            <div className="saved-project-options">
              {eligible.map((p) => (
                <button
                  key={p.id}
                  className="secondary"
                  disabled={busy}
                  onClick={() => start(p.id)}
                >
                  {p.title}
                  <small>
                    {p.category} · {p.zip}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <>
              <p>
                No available projects for this professional. View their profile
                or post a project to get started.
              </p>
              <button
                onClick={() => {
                  setIntent(null);
                  go("projects", "new");
                }}
              >
                Post a project
              </button>
            </>
          )}
        </dialog>
      )}
      {callProject && (
        <CallScheduler
          projectId={callProject}
          proId={proId}
          onClose={() => setCallProject("")}
          onDone={() => {
            setCallProject("");
            go("schedule");
          }}
        />
      )}
    </>
  );
}
