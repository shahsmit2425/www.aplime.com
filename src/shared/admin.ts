import type { Notice, Profile, Ticket, User } from "./domain.js";
import { businessFields } from "./business.js";
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
  user: User & {
    createdAt: string;
    suspendedAt: string | null;
    suspensionReason: string | null;
    sessionsRevokedAt: string | null;
    deletedAt: string | null;
  };
  metrics: Record<string, number>;
  profile: Profile | null;
  published: PublishedListing | null;
  membership: RecordRow | null;
  projects: RecordRow[];
  tickets: Ticket[];
  notes: { id: string; body: string; author: string; createdAt: string }[];
};
export type PlatformSetting = {
  key: string;
  label: string;
  description: string;
  updatedAt: string | null;
  updatedBy: string | null;
} & (
  | { kind: "switch"; value: boolean; default: boolean }
  | { kind: "limit"; value: number; default: number; min: number; max: number }
);
export type AdminPlatform = {
  settings: PlatformSetting[];
  history: RecordRow[];
};
export type AdminHealth = {
  environment: string;
  release: string;
  uptimeSeconds: number;
  checkedAt: string;
  database: { status: string; responseMs: number };
  liveUpdates: { status: string };
  queues: Record<string, number | string | null>;
  configured: Record<string, boolean>;
};
export type AdminPaymentDetail = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "refunded";
  createdAt: string;
  receiptUrl: string | null;
  projectId: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
  proId: string | null;
  proName: string | null;
};
// The approved version of a listing that customers see while edits wait.
export type PublishedListing = Pick<
  Profile,
  "business" | "category" | "bio" | "zip" | "rate" | "details"
> & { images: NonNullable<Profile["images"]> };
const listingFields = [
  ["business", "Business name"],
  ["category", "Main service"],
  ["bio", "Business description"],
  ["rate", "Starting hourly rate (USD)"],
  ["zip", "ZIP code"],
] as const;
// What an administrator is being asked to approve: every reviewed field and
// photo that differs between the approved listing and the saved profile.
export function listingChanges(published: PublishedListing, profile: Profile) {
  const shown = (value: unknown) => String(value ?? "").trim();
  const fields = [
    ...listingFields.map(([key, label]) => ({
      label,
      before: shown(published[key]),
      after: shown(profile[key]),
    })),
    ...businessFields.map(({ key, label }) => ({
      label,
      before: shown(published.details?.[key]),
      after: shown(profile.details?.[key]),
    })),
  ].filter((field) => field.before !== field.after);
  const current = profile.images || [];
  const missingFrom = (images: PublishedListing["images"]) => {
    const ids = new Set(images.map((image) => image.id));
    return (image: { id: string }) => !ids.has(image.id);
  };
  return {
    fields,
    addedImages: current.filter(missingFrom(published.images)),
    removedImages: published.images.filter(missingFrom(current)),
  };
}
