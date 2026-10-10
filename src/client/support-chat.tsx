import { useEffect, useRef, useState } from "react";
import type { SupportThread } from "../shared/support.js";
import {
  ChatHeader,
  ChatLog,
  ChatComposer,
  useChatRead,
} from "../shared/chat-ui.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
export function SupportChat({
  conversationId,
  create = false,
}: {
  conversationId?: string;
  create?: boolean;
}) {
  const { data, go, run, busy } = useWorkspace();
  const [thread, setThread] = useState<SupportThread | null>(null),
    [error, setError] = useState(""),
    [body, setBody] = useState(""),
    [page, setPage] = useState(1),
    [tick, setTick] = useState(0);
  const clientKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!conversationId) return;
    let stopped = false,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await request<SupportThread>(
          `/support/conversations/${conversationId}?page=${page}`,
        );
        if (!stopped) {
          setThread(result);
          setError("");
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
    window.addEventListener("aplime:updates", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("aplime:updates", load);
    };
  }, [conversationId, page, tick]);
  useChatRead(
    page === 1 && thread?.page === 1 ? thread.ticket.unreadNoticeIds || [] : [],
    (noticeIds) =>
      request(`/support/conversations/${conversationId}/read`, { noticeIds }),
  );
  if (create)
    return (
      <div className="chat-thread">
        <ChatHeader
          title="Aplime support"
          subtitle="A real conversation with our team"
          support
          back={() => go("messages")}
        />
        <form
          className="chat-new-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const result = await request<{ id: string }>(
                "/support/conversations",
                { subject: f.get("subject"), body: f.get("body") },
              );
              go("messages", "support:" + result.id);
            }, "");
          }}
        >
          <h3>How can we help?</h3>
          <p>
            Ask about your account, your business or a project. Replies appear
            in Messages. Never send passwords or identity documents.
          </p>
          <label>
            Subject
            <input
              name="subject"
              required
              minLength={5}
              maxLength={120}
              placeholder="What would you like help with?"
            />
          </label>
          <label>
            Your message
            <textarea
              name="body"
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              placeholder="Tell us what happened and how we can help."
            />
          </label>
          <button disabled={busy}>Send to Aplime support</button>
        </form>
      </div>
    );
  const t = thread?.page === page ? thread.ticket : undefined;
  return (
    <div className="chat-thread">
      <ChatHeader
        title="Aplime support"
        support
        subtitle={
          t
            ? t.subject + " · " + (t.status === "open" ? "Open" : "Resolved")
            : "Loading conversation…"
        }
        back={() => go("messages")}
      />
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {!t && !error && (
        <p className="chat-status" role="status">
          Loading messages…
        </p>
      )}
      {thread && t && (
        <>
          <ChatLog
            threadKey={t.id + ":" + page}
            messages={[
              ...(page * 50 >= thread.total
                ? [
                    {
                      id: t.id,
                      body: t.body,
                      name:
                        t.openedBy === data.user.id || !t.openedBy
                          ? data.user.name
                          : "Aplime support",
                      time: t.createdAt,
                      mine: t.openedBy === data.user.id || !t.openedBy,
                    },
                  ]
                : []),
              ...thread.messages.map((m) => ({
                id: m.id,
                body: m.body,
                name:
                  m.senderRole === "admin" ? "Aplime support" : m.senderName,
                time: m.createdAt,
                mine: m.senderId === data.user.id,
              })),
            ]}
            before={
              thread.total > 50 && (
                <div className="chat-pager">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Newer
                  </button>
                  <span>Page {page}</span>
                  <button
                    disabled={page * 50 >= thread.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Older
                  </button>
                </div>
              )
            }
          />
          {t.resolution && (
            <div className="chat-extra">Resolution: {t.resolution}</div>
          )}
          {t.status === "open" ? (
            <ChatComposer
              value={body}
              onChange={setBody}
              disabled={busy}
              send={() =>
                void run(async () => {
                  await request(
                    `/support/conversations/${conversationId}/messages`,
                    { body, clientKey: clientKey.current },
                  );
                  setBody("");
                  clientKey.current = crypto.randomUUID();
                  setPage(1);
                  setTick((t) => t + 1);
                }, "")
              }
            />
          ) : (
            <div className="chat-extra">
              <p>
                This conversation is resolved. You can reopen it for more help.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request(
                      `/support/conversations/${conversationId}/reopen`,
                      {},
                    );
                    setTick((t) => t + 1);
                  }, "")
                }
              >
                Reopen conversation
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
