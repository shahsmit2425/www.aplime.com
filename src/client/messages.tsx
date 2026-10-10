import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ChatInbox, type ChatItem } from "../shared/chat-ui.js";
import {
  selectedDiscussion,
  supportConversationId,
  type Discussion,
} from "../shared/chat.js";
import type { SupportTicket } from "../shared/support.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Discussions } from "./discussions.js";
import { SupportChat } from "./support-chat.js";
export function MessagesInbox({
  legacySupportId,
}: {
  legacySupportId?: string;
}) {
  const { id: routeId, go, data } = useWorkspace();
  const id = legacySupportId ? "support:" + legacySupportId : routeId;
  const [projects, setProjects] = useState<Discussion[]>([]),
    [support, setSupport] = useState<SupportTicket[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      const results = await Promise.allSettled([
        request<Discussion[]>("/discussions"),
        request<{ rows: SupportTicket[]; total: number }>(
          "/support/conversations?page=" + page,
        ),
      ]);
      if (!stopped) {
        const [p, s] = results;
        if (p.status === "fulfilled") setProjects(p.value);
        if (s.status === "fulfilled") {
          setSupport(s.value.rows);
          setTotal(s.value.total);
        }
        const failed = results.find((r) => r.status === "rejected");
        setError(
          failed?.status === "rejected"
            ? failed.reason instanceof Error
              ? failed.reason.message
              : "Some conversations could not load."
            : "",
        );
        setLoading(false);
      }
      pending = false;
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    window.addEventListener("aplime:updates", load);
    window.addEventListener("aplime:chat-read", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("aplime:updates", load);
      window.removeEventListener("aplime:chat-read", load);
    };
  }, [page, data.user.id]);
  const project = selectedDiscussion(projects, id),
    supportId = supportConversationId(id);
  const items: ChatItem[] = [
    ...projects.map((t) => ({
      id: t.id,
      name: data.user.role === "customer" ? t.business : t.customer_name,
      subtitle: t.title,
      preview: t.messages.at(-1)?.body || "Project conversation",
      time: t.messages.at(-1)?.created_at,
      unread: t.unread_count || 0,
    })),
    ...support.map((t) => ({
      id: "support:" + t.id,
      name: "Aplime support",
      subtitle: t.subject,
      preview: t.lastMessage,
      time: t.updatedAt,
      unread: t.unreadCount,
      support: true,
    })),
  ].sort(
    (a, b) =>
      Date.parse(b.time || "1970-01-01") - Date.parse(a.time || "1970-01-01"),
  );
  return (
    <ChatInbox
      items={items}
      selected={id}
      loading={loading}
      error={error}
      onSelect={(key) => go("messages", key)}
      tools={
        <button
          aria-label="New support conversation"
          onClick={() => go("messages", "new-support")}
        >
          <Plus size={19} /> Support
        </button>
      }
      footer={
        <>
          <span>
            {projects.length} project chats · {total} support conversations
          </span>
          {total > 25 && (
            <div className="chat-pager">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous support
              </button>
              <span>{page}</span>
              <button
                disabled={page * 25 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      }
    >
      {id === "new-support" ? (
        <SupportChat key="new" create />
      ) : supportId ? (
        <SupportChat key={supportId} conversationId={supportId} />
      ) : project ? (
        <Discussions
          key={project.id}
          focusedId={project.id}
          initialThread={project}
          embedded
        />
      ) : id && !loading ? (
        <div className="chat-empty">
          <h2>Conversation unavailable</h2>
          <p>Choose an existing conversation or contact Aplime support.</p>
          <button onClick={() => go("messages")}>All conversations</button>
        </div>
      ) : undefined}
    </ChatInbox>
  );
}
