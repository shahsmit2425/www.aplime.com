import { ProjectQuickView } from "./project-quick-view.js";
import { useEffect, useState, useRef } from "react";
import { FileText, MessageCircle, Phone, Video } from "lucide-react";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Field, Form } from "./ui.js";
import {
  selectedDiscussion,
  discussionContext,
  type Discussion,
} from "../shared/chat.js";
import {
  ChatHeader,
  ChatLog,
  ChatComposer,
  useChatRead,
} from "../shared/chat-ui.js";
export function Discussions({
  projectId,
  canStart = false,
  focusedId,
  embedded = false,
  initialThread,
}: {
  projectId?: string;
  canStart?: boolean;
  focusedId?: string;
  embedded?: boolean;
  initialThread?: Discussion;
}) {
  const { data, run, busy, id, go } = useWorkspace();
  const [threads, setThreads] = useState<Discussion[]>(
      initialThread ? [initialThread] : [],
    ),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = async () => {
    const rows = await request<Discussion[]>("/discussions");
    if (mounted.current) {
      setThreads(rows);
      setError("");
    }
  };
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      return request<Discussion[]>("/discussions")
        .then((rows) => {
          if (active) {
            setThreads(rows);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          pending = false;
        });
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("aplime:updates", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("aplime:updates", refresh);
    };
  }, [data.user.id]);
  const visible = threads.filter(
    (t) =>
      !projectId ||
      t.project_id === projectId ||
      !!t.projects?.some((p) => p.id === projectId),
  );
  const thread =
    selectedDiscussion(visible, focusedId || selected || id) ||
    (focusedId ? undefined : visible[0]);
  const [contextId, setContextId] = useState("");
  const [showProject, setShowProject] = useState(false);
  const contexts =
    thread?.projects ||
    (thread
      ? [
          {
            id: thread.project_id,
            title: thread.title,
            status: thread.status,
            selected_pro: thread.selected_pro,
          },
        ]
      : []);
  const context =
    contexts.find((p) => p.id === contextId) ||
    (thread ? discussionContext(thread, id) : undefined);
  useEffect(() => {
    setContextId("");
    setShowProject(false);
  }, [thread?.id, id]);
  const other = thread
    ? thread.customer_id === data.user.id
      ? thread.pro_id
      : thread.customer_id
    : "";
  const closed = !!thread?.read_only;
  const blocked = data.blocked.includes(other);
  useEffect(() => setSelected(""), [id]);
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(""), [thread?.id]);
  const [suggestion, setSuggestion] = useState("");
  useEffect(() => setSuggestion(""), [thread?.id]);
  useChatRead(thread?.unread_notice_ids || [], (noticeIds) =>
    request(`/discussions/${thread!.id}/read`, { noticeIds }),
  );
  const content = (
    <>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {!!visible.length && (
        <div className={embedded ? "chat-thread" : "discussion-layout"}>
          {!embedded && (
            <nav aria-label="Project discussions">
              {visible.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={
                    thread?.id === t.id
                      ? "discussion-choice active"
                      : "discussion-choice"
                  }
                  onClick={() => setSelected(t.id)}
                >
                  <MessageCircle size={18} />
                  <span>
                    <strong>
                      {data.user.role === "customer"
                        ? t.business
                        : t.customer_name}
                    </strong>
                    <small>{t.title}</small>
                  </span>
                </button>
              ))}
            </nav>
          )}
          {thread && (
            <section className="chat-thread">
              <ChatHeader
                title={
                  data.user.role === "customer"
                    ? thread.business
                    : thread.customer_name
                }
                subtitle={
                  contexts.length > 1
                    ? `${contexts.length} shared projects`
                    : context?.title || "Private conversation"
                }
                back={embedded ? () => go("messages") : undefined}
                actions={
                  <>
                    <button
                      className="chat-project-details"
                      aria-label="Project details"
                      title="Project details"
                      onClick={() => setShowProject(true)}
                      disabled={!context}
                    >
                      <FileText size={17} />
                      <span>Project details</span>
                    </button>
                    {[true, false].map((audio) => (
                      <button
                        key={String(audio)}
                        disabled={busy || closed || blocked}
                        aria-label={
                          audio ? "Start audio call" : "Start video call"
                        }
                        onClick={() =>
                          void run(async () => {
                            const r = await request(
                              `/discussions/${thread.id}/call`,
                              { audioOnly: audio, projectId: context?.id },
                            );
                            await openExternal(r.url);
                          }, "")
                        }
                      >
                        {audio ? <Phone size={17} /> : <Video size={17} />}
                      </button>
                    ))}
                  </>
                }
              />
              {contexts.length > 1 && (
                <label className="chat-project-context">
                  <span>Discussing</span>
                  <select
                    aria-label="Project being discussed"
                    value={context?.id || ""}
                    onChange={(e) => setContextId(e.target.value)}
                  >
                    {contexts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ChatLog
                threadKey={thread.id}
                messages={thread.messages.map((m) => ({
                  id: m.id,
                  body: m.body,
                  name:
                    (data.user.role === "customer"
                      ? thread.business
                      : thread.customer_name) +
                    (contexts.length > 1 && m.project_id
                      ? " · " +
                        (contexts.find((p) => p.id === m.project_id)?.title ||
                          "Project")
                      : ""),
                  time: m.created_at,
                  mine: m.sender_id === data.user.id,
                }))}
              />
              {closed || blocked ? (
                <div className="chat-extra">
                  {blocked
                    ? "This conversation is blocked. Unblock it to reply."
                    : "Messaging is unavailable for this conversation. Your history remains available."}
                </div>
              ) : (
                <ChatComposer
                  value={draft}
                  onChange={setDraft}
                  disabled={busy}
                  send={() =>
                    void run(async () => {
                      await request(`/discussions/${thread.id}/messages`, {
                        body: draft,
                        projectId: context?.id,
                      });
                      setDraft("");
                      await load();
                    }, "")
                  }
                />
              )}
              {showProject && context && (
                <ProjectQuickView
                  conversationId={thread.id}
                  projectId={context.id}
                  onClose={() => setShowProject(false)}
                />
              )}
              <div className="chat-extra">
                {!closed && !blocked && (
                  <details className="suggest-time">
                    <summary>Suggest a time to meet or visit</summary>
                    <form
                      className="composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const when = new Date(suggestion);
                        if (Number.isNaN(when.getTime()) || when < new Date())
                          return setError("Choose a time in the future.");
                        void run(async () => {
                          await request(`/discussions/${thread.id}/messages`, {
                            projectId: context?.id,
                            body: `Could we meet on ${when.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}? Reply here, or confirm it as the project appointment.`,
                          });
                          setSuggestion("");
                          await load();
                        }, "");
                      }}
                    >
                      <label className="sr-only" htmlFor="suggest-time-input">
                        Suggested time
                      </label>
                      <input
                        id="suggest-time-input"
                        type="datetime-local"
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                        required
                      />
                      <button disabled={busy || !suggestion}>
                        Send suggestion
                      </button>
                    </form>
                  </details>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => request(`/blocked/${other}`, { blocked: !blocked }),
                      "",
                    )
                  }
                >
                  {blocked ? "Unblock" : "Block"} conversation
                </button>
              </div>
            </section>
          )}
        </div>
      )}
      {!visible.length && !canStart && (
        <p>No private chats yet. New project conversations will appear here.</p>
      )}
      {canStart && !visible.length && projectId && (
        <Form
          busy={busy}
          onSubmit={(f) =>
            run(async () => {
              await request(`/projects/${projectId}/discussions`, {
                body: f.get("body"),
              });
              await load();
            }, "Your assessment request was sent.")
          }
        >
          <Field label="Your first message to the customer">
            <textarea
              name="body"
              required
              minLength={10}
              maxLength={4000}
              placeholder="Introduce your business and ask a clear question about the scope, measurements, access, or timing."
            />
          </Field>
          <button>Start private chat</button>
        </Form>
      )}
    </>
  );
  return embedded ? (
    content
  ) : (
    <Panel title="Project conversations">{content}</Panel>
  );
}
