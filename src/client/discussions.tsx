import { useEffect, useState, useRef } from "react";
import { MessageCircle, Phone, Video } from "lucide-react";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Field, Form } from "./ui.js";
import type { Discussion } from "../shared/chat.js";
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
    (t) => !projectId || t.project_id === projectId,
  );
  const thread = focusedId
    ? visible.find((t) => t.id === focusedId)
    : visible.find((t) => t.id === selected) ||
      visible.find((t) => t.id === id) ||
      visible.find(
        (t) =>
          t.project_id === id &&
          !!t.selected_pro &&
          t.selected_pro === t.pro_id,
      ) ||
      visible.find((t) => t.project_id === id) ||
      visible[0];
  const other = thread
    ? thread.customer_id === data.user.id
      ? thread.pro_id
      : thread.customer_id
    : "";
  const closed =
    !!thread &&
    (["cancelled", "disputed"].includes(thread.status) ||
      (!!thread.selected_pro && thread.selected_pro !== thread.pro_id));
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
                subtitle={thread.title}
                back={embedded ? () => go("messages") : undefined}
                actions={
                  <>
                    {!projectId && (
                      <button onClick={() => go("project", thread.project_id)}>
                        Project
                      </button>
                    )}
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
                              { audioOnly: audio },
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
              <ChatLog
                threadKey={thread.id}
                messages={thread.messages.map((m) => ({
                  id: m.id,
                  body: m.body,
                  name:
                    data.user.role === "customer"
                      ? thread.business
                      : thread.customer_name,
                  time: m.created_at,
                  mine: m.sender_id === data.user.id,
                }))}
              />
              {closed || blocked ? (
                <div className="chat-extra">
                  {blocked
                    ? "This conversation is blocked. Unblock it to reply."
                    : "This discussion is closed. Your messages remain available."}
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
                      });
                      setDraft("");
                      await load();
                    }, "")
                  }
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
