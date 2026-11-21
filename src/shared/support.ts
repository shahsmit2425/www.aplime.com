import type { Ticket } from "./domain.js";
export type SupportTicket = Ticket & {
  userName: string;
  userEmail: string;
  openedByName: string;
  messageCount: number;
  updatedAt: string;
  openedBy: string | null;
  lastMessage: string;
  unreadCount: number;
  unreadNoticeIds: string[];
};
type SupportMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: string;
};
export type SupportThread = {
  ticket: SupportTicket;
  messages: SupportMessage[];
  total: number;
  page: number;
};
