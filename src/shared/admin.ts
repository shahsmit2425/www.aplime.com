import type { Notice, Profile, Ticket, User } from "./domain.js";
export type AdminSession = {
  user: User;
  notices: Notice[];
  unreadCount: number;
};
export type RecordRow = Record<string, string | number | boolean | null>;
export type RecordPage = {
  rows: RecordRow[];
  total: number;
  page: number;
  pageSize: number;
};
export type AdminOverview = {
  totals: Record<string, number>;
  trend: { day: string; users: number; projects: number; messages: number }[];
  statuses: { label: string; count: number }[];
  categories: { label: string; count: number }[];
  engagement: RecordRow[];
  recent: RecordRow[];
  generatedAt: string;
};
export type AdminUserDetail = {
  user: User & { createdAt: string };
  metrics: Record<string, number>;
  profile: Profile | null;
  membership: RecordRow | null;
  projects: RecordRow[];
  tickets: Ticket[];
};
