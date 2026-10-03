import { useEffect, useState } from "react";
import { MessageCircle, Phone, Video } from "lucide-react";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Field, Form } from "./ui.js";
type Discussion = {
  id: string;
  project_id: string;
  pro_id: string;
  customer_id: string;
  title: string;
  business: string;
  customer_name: string;
  status: string;
  selected_pro: string | null;
  messages: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }[];
};
export function Discussions({
  projectId,
  canStart = false,
}: {
  projectId?: string;
  canStart?: boolean;
}) {
  const { data, run, busy, id, go } = useWorkspace();
  const [threads, setThreads] = useState<Discussion[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  const load = async () => {
    const rows = await request<Discussion[]>("/discussions");
    setThreads(rows);
    setError("");
  };
  useEffect(() => {
    let active = true;
    const refresh = () =>
      request<Discussion[]>("/discussions")
        .then((rows) => {
          if (active) {
            setThreads(rows);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
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
  const thread =
    visible.find((t) => t.id === selected) ||
    visible.find((t) => t.id === id || t.project_id === id) ||
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
  return (
    <Panel title="Private project chat">
      <p>
        {data.user.role === "customer"
          ? "Each professional has a separate private conversation with you. Chatting or calling does not book the job."
          : "Only you and this customer can read this conversation. Chatting or calling does not book the job."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!!visible.length && (
        <div className="discussion-layout">
          <nav aria-label="Professional discussions">
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
          {thread && (
            <section className="discussion-content">
              <h3>
                {data.user.role === "customer"
                  ? thread.business
                  : thread.customer_name}
              </h3>
              <div className="actions">
                {!projectId && (
                  <button
                    className="secondary"
                    onClick={() => go("project", thread.project_id)}
                  >
                    View project
                  </button>
                )}
                {[true, false].map((audio) => (
                  <button
                    key={String(audio)}
                    className="secondary"
                    disabled={busy || closed || blocked}
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
                    {audio ? <Phone size={16} /> : <Video size={16} />}{" "}
                    {audio ? "Audio call" : "Video call"}
                  </button>
                ))}
              </div>
              <div
                className="discussion-log"
                role="log"
                aria-label="Private discussion"
              >
                {thread.messages.map((m) => (
                  <article
                    key={m.id}
                    className={
                      m.sender_id === data.user.id ? "message mine" : "message"
                    }
                  >
                    <p>{m.body}</p>
                    <small>{new Date(m.created_at).toLocaleString()}</small>
                  </article>
                ))}
              </div>
              {closed ? (
                <p>
                  This discussion is closed. Your messages remain available.
                </p>
              ) : (
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await request(`/discussions/${thread.id}/messages`, {
                        body: draft,
                      });
                      setDraft("");
                      await load();
                    }, "");
                  }}
                >
                  <label className="sr-only" htmlFor="discussion-reply">
                    Reply
                  </label>
                  <input
                    id="discussion-reply"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask about scope, timing, or an assessment…"
                    maxLength={4000}
                    disabled={busy || blocked}
                  />
                  <button disabled={busy || blocked || !draft.trim()}>
                    Send
                  </button>
                </form>
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
    </Panel>
  );
}
