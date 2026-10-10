import { useEffect, useRef, useState } from "react";
import { MessageCircle, ArrowLeft, Send } from "lucide-react";
import type { SupportThread, SupportTicket } from "../shared/support.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Panel, Field, Form } from "./ui.js";
const date = (value: string) => new Date(value).toLocaleString();
export function SupportChat() {
  const { data, id, go, run, busy } = useWorkspace();
  const [list, setList] = useState<{
      rows: SupportTicket[];
      total: number;
    } | null>(null),
    [thread, setThread] = useState<SupportThread | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [messagePage, setMessagePage] = useState(1),
    [body, setBody] = useState("");
  const clientKey = useRef(crypto.randomUUID()),
    [tick, setTick] = useState(0);
  useEffect(() => {
    let stopped = false;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        if (id) {
          const result = await request<SupportThread>(
            `/support/conversations/${encodeURIComponent(id)}?page=${messagePage}`,
          );
          if (!stopped) {
            setThread(result);
            setError("");
          }
        } else {
          const result = await request<{
            rows: SupportTicket[];
            total: number;
          }>("/support/conversations?page=" + page);
          if (!stopped) {
            setList(result);
            setError("");
          }
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Support is unavailable.");
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id, page, messagePage, tick, data.notices]);
  useEffect(() => {
    setThread(null);
    setBody("");
    setMessagePage(1);
    clientKey.current = crypto.randomUUID();
  }, [id]);
  if (id)
    return (
      <Panel title="Your conversation with Aplime">
        <button className="secondary" onClick={() => go("help")}>
          <ArrowLeft size={16} /> All support conversations
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {thread ? (
          <>
            <h3>{thread.ticket.subject}</h3>
            <p>
              {thread.ticket.status === "open"
                ? "Open · Aplime support can reply here"
                : "Resolved"}
            </p>
            <div
              className="support-chat-log"
              role="log"
              aria-label="Messages with Aplime support"
            >
              <article>
                <strong>{thread.ticket.openedByName}</strong>
                <p>{thread.ticket.body}</p>
                <small>{date(thread.ticket.createdAt)}</small>
              </article>
              {thread.messages.map((m) => (
                <article
                  key={m.id}
                  className={m.senderRole === "admin" ? "support-team" : ""}
                >
                  <strong>
                    {m.senderRole === "admin" ? "Aplime support" : m.senderName}
                  </strong>
                  <p>{m.body}</p>
                  <small>{date(m.createdAt)}</small>
                </article>
              ))}
            </div>
            <div className="support-pager">
              <button
                disabled={messagePage <= 1}
                onClick={() => setMessagePage((p) => p - 1)}
              >
                Newer replies
              </button>
              <span>
                {thread.total} replies · page {messagePage}
              </span>
              <button
                disabled={messagePage * 50 >= thread.total}
                onClick={() => setMessagePage((p) => p + 1)}
              >
                Older replies
              </button>
            </div>
            {thread.ticket.resolution && (
              <p className="business-tip">
                Resolution: {thread.ticket.resolution}
              </p>
            )}
            {thread.ticket.status === "open" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await request(
                      `/support/conversations/${encodeURIComponent(id)}/messages`,
                      { body, clientKey: clientKey.current },
                    );
                    setBody("");
                    clientKey.current = crypto.randomUUID();
                    setMessagePage(1);
                    setTick((t) => t + 1);
                  }, "Message sent to Aplime support.");
                }}
              >
                <Field label="Your reply">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={4000}
                    required
                    rows={3}
                  />
                </Field>
                <button disabled={busy || !body.trim()}>
                  <Send size={16} /> Send reply
                </button>
              </form>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request(
                      `/support/conversations/${encodeURIComponent(id)}/reopen`,
                      {},
                    );
                    setTick((t) => t + 1);
                  }, "Conversation reopened.")
                }
              >
                Reopen conversation
              </button>
            )}
          </>
        ) : (
          !error && <p role="status">Loading conversation…</p>
        )}
      </Panel>
    );
  return (
    <>
      <Panel title="Message Aplime support">
        <p>
          Ask about your account, business setup or a project. Replies appear
          here and generate account notifications. Do not send passwords or
          identity documents.
        </p>
        <Form
          busy={busy}
          onSubmit={(f) =>
            run(async () => {
              const result = await request<{ id: string }>(
                "/support/conversations",
                { subject: f.get("subject"), body: f.get("body") },
              );
              go("help", result.id);
            }, "Support conversation created.")
          }
        >
          <Field label="Subject">
            <input name="subject" required minLength={5} maxLength={120} />
          </Field>
          <Field label="How can we help?">
            <textarea
              name="body"
              required
              minLength={10}
              maxLength={4000}
              rows={4}
            />
          </Field>
          <button>
            <MessageCircle size={17} /> Start conversation
          </button>
        </Form>
      </Panel>
      <Panel title="Your support conversations">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {list ? (
          list.rows.length ? (
            <div className="support-thread-list">
              {list.rows.map((t) => (
                <button key={t.id} onClick={() => go("help", t.id)}>
                  <MessageCircle size={20} />
                  <span>
                    <strong>{t.subject}</strong>
                    <small>
                      {t.status} · {t.messageCount} replies ·{" "}
                      {date(t.updatedAt)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p>No support conversations yet.</p>
          )
        ) : (
          <p role="status">Loading conversations…</p>
        )}
        <div className="support-pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>{list?.total || 0} conversations</span>
          <button
            disabled={page * 25 >= (list?.total || 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </Panel>
    </>
  );
}
