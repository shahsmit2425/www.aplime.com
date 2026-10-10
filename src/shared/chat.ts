export type Discussion = {
  id: string;
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
  }[];
};
export function selectedDiscussion(threads: Discussion[], id?: string) {
  if (!id || id.startsWith("support:") || id === "new-support")
    return undefined;
  return (
    threads.find((t) => t.id === id) ||
    threads.find((t) => t.project_id === id && t.pro_id === t.selected_pro) ||
    threads.find((t) => t.project_id === id)
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
