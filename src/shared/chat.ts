export type Discussion = {
  id: string;
  aliases?: string[];
  projects?: {
    discussion_id?: string;
    id: string;
    title: string;
    status: string;
    selected_pro: string | null;
  }[];
  read_only?: boolean;
  project_id: string;
  pro_id: string;
  customer_id: string;
  title: string;
  business: string;
  customer_name: string;
  status: string;
  selected_pro: string | null;
  unread_count: number;
  unread_notice_ids: string[];
  messages: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    project_id?: string;
  }[];
};
export function selectedDiscussion(threads: Discussion[], id?: string) {
  if (!id || id.startsWith("support:") || id === "new-support")
    return undefined;
  const [conversationId, projectId, extra] = id.split("~");
  if (projectId) {
    if (extra) return undefined;
    return threads.find(
      (t) =>
        (t.id === conversationId || t.aliases?.includes(conversationId)) &&
        t.projects?.some((p) => p.id === projectId),
    );
  }
  return (
    threads.find((t) => t.id === id || t.aliases?.includes(id)) ||
    threads.find(
      (t) =>
        (t.project_id === id && t.pro_id === t.selected_pro) ||
        t.projects?.some((p) => p.id === id && p.selected_pro === t.pro_id),
    ) ||
    threads.find(
      (t) => t.project_id === id || t.projects?.some((p) => p.id === id),
    )
  );
}
export function supportConversationId(id?: string) {
  return id?.startsWith("support:") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id.slice(8),
    )
    ? id.slice(8)
    : undefined;
}

export function discussionRoute(conversationId: string, projectId: string) {
  return conversationId + "~" + projectId;
}
export function discussionContext(thread: Discussion, routeId?: string) {
  const contexts = thread.projects || [
    {
      id: thread.project_id,
      title: thread.title,
      status: thread.status,
      selected_pro: thread.selected_pro,
    },
  ];
  const [conversationId, explicitProject] = (routeId || "").split("~");
  const requested = contexts.find(
    (p) =>
      p.id === explicitProject ||
      p.id === routeId ||
      (conversationId !== thread.id && p.discussion_id === routeId),
  );
  return (
    requested ||
    contexts.find((p) => p.id === thread.messages.at(-1)?.project_id) ||
    contexts[0]
  );
}
