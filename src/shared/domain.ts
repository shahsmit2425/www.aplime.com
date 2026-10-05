import type { WeeklyHours } from "./preferences.js";
import type { BusinessImage } from "./business-images.js";
import { businessDetailsSchema, type BusinessDetails } from "./business.js";
import { z } from "zod";
import {
  categories,
  questionsFor,
  type ServiceCategory,
} from "./service-questionnaires.js";
export { categories } from "./service-questionnaires.js";
export type Role = "customer" | "pro" | "admin";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  settings: Record<string, unknown>;
};
export type Profile = {
  address: string;
  placeId: string;
  serviceCategories: string[];
  weeklyHours: WeeklyHours;
  timeZone: string;
  matchedProjectIds?: string[];
  discoverable?: boolean;
  images?: BusinessImage[];
  id: string;
  name: string;
  business: string;
  category: string;
  bio: string;
  zip: string;
  rate: number;
  verified: boolean;
  suspended: boolean;
  available: boolean;
  availability: string[];
  rating: number;
  reviewCount: number;
  connectReady?: boolean;
  serviceRadiusMiles: number;
  reviewStatus:
    "draft" | "pending" | "changes_requested" | "approved" | "rejected";
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  details?: BusinessDetails;
};
export const statuses = [
  "requested",
  "quoted",
  "booked",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type Status = (typeof statuses)[number];
export type Project = {
  version?: number;
  archived?: boolean;
  pausedFrom?: Status | null;
  pausedBy?: string | null;
  pauseReason?: string | null;
  completionRequestedBy?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRequestId?: string | null;
  cancellationReason?: string | null;
  address?: string;
  placeId?: string;
  addressUnit?: string;
  id: string;
  customerId: string;
  proId: string | null;
  title: string;
  description: string;
  intake?: Record<string, string>;
  urgency: "urgent" | "this_week" | "this_month" | "flexible";
  propertyType: "home" | "apartment" | "condo" | "commercial" | "other";
  budgetMin: number | null;
  budgetMax: number | null;
  latitude?: number | null;
  longitude?: number | null;
  category: string;
  zip: string;
  scheduledAt: string | null;
  status: Status;
  amount: number | null;
  createdAt: string;
  completionRequested?: boolean;
  proposedAt?: string | null;
  proposedBy?: string | null;
  customerName?: string;
  proName?: string;
};
export type Quote = {
  revision: number;
  id: string;
  projectId: string;
  proId: string;
  amount: number;
  laborAmount: number;
  materialsAmount: number;
  description: string;
  exclusions: string;
  timeline: string;
  expiresAt: string | null;
  status: string;
  createdAt: string;
};
export type Message = {
  id: string;
  projectId: string;
  senderId: string;
  body: string;
  createdAt: string;
};
export type Payment = {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  createdAt: string;
  receiptUrl: string | null;
};
export type Review = {
  id: string;
  projectId: string;
  proId: string;
  rating: number;
  body: string;
  reply: string | null;
  createdAt: string;
};
export type Ticket = {
  id: string;
  userId: string;
  projectId: string | null;
  subject: string;
  body: string;
  status: string;
  resolution: string | null;
  createdAt: string;
};
export type Notice = {
  targetPage: string;
  targetId: string | null;
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
export type Upload = {
  id: string;
  projectId: string;
  name: string;
  contentType: string;
  size: number;
  status: string;
};
export type Workspace = {
  discoveryMode?: "open" | "matched";
  discoveryRequirements?: string[];
  user: User;
  profiles: Profile[];
  projects: Project[];
  leads: Project[];
  quotes: Quote[];
  messages: Message[];
  payments: Payment[];
  reviews: Review[];
  tickets: Ticket[];
  notices: Notice[];
  unreadCount: number;
  uploads: Upload[];
  saved: string[];
  blocked: string[];
};
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const signupSchema = z
  .object({ name: text(2, 80), role: z.enum(["customer", "pro"]) })
  .strict();
export const profileSchema = z
  .object({
    business: text(2, 100),
    details: businessDetailsSchema,
    category: z.enum(categories),
    bio: text(20, 2000),
    placeId: text(3, 300),
    address: text(5, 300),
    rate: z.number().min(1).max(10000),
    serviceRadiusMiles: z.number().int().min(1).max(100),
    available: z.boolean(),
    availability: z
      .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
      .max(7),
  })
  .strict();
export const projectSchema = z
  .object({
    title: text(5, 120),
    description: text(20, 4000),
    category: z.enum(categories),
    intake: z.record(z.string().max(64), text(1, 1500)),
    placeId: text(3, 300),
    address: text(5, 300),
    addressUnit: z.string().trim().max(100).default(""),
    urgency: z.enum(["urgent", "this_week", "this_month", "flexible"]),
    propertyType: z.enum(["home", "apartment", "condo", "commercial", "other"]),
    budgetMin: z.number().int().min(0).max(10000000).nullable(),
    budgetMax: z.number().int().min(0).max(10000000).nullable(),
    proId: z.string().min(1).max(128).nullable().default(null),
    scheduledAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine((project, context) => {
    if (
      project.budgetMin !== null &&
      project.budgetMax !== null &&
      project.budgetMin > project.budgetMax
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budgetMax"],
        message: "Maximum budget must be at least the minimum budget",
      });
    const questions = questionsFor(project.category as ServiceCategory);
    const allowed = new Set(questions.map((question) => question.id));
    for (const question of questions) {
      const answer = project.intake[question.id]?.trim();
      if (question.required && !answer)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intake", question.id],
          message: `Answer “${question.label}”`,
        });
      if (answer && question.options && !question.options.includes(answer))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intake", question.id],
          message: "Choose one of the available answers",
        });
    }
    for (const key of Object.keys(project.intake))
      if (!allowed.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intake", key],
          message: "Unexpected questionnaire answer",
        });
  });
export const actionSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("quote"),
        laborAmount: z.number().int().min(0).max(10000000),
        materialsAmount: z.number().int().min(0).max(10000000),
        description: text(10, 2000),
        exclusions: z.string().trim().max(2000),
        timeline: text(3, 300),
        expiresAt: z.string().datetime().nullable(),
      })
      .strict(),
    z
      .object({
        type: z.literal("accept"),
        quoteId: z.string().uuid(),
        revision: z.number().int().positive(),
      })
      .strict(),
    z
      .object({ type: z.literal("decline"), quoteId: z.string().uuid() })
      .strict(),
    z.object({ type: z.literal("start") }).strict(),
    z
      .object({ type: z.literal("withdraw_quote"), reason: text(5, 1000) })
      .strict(),
    z.object({ type: z.literal("complete") }).strict(),
    z.object({ type: z.literal("confirm_completion") }).strict(),
    z
      .object({ type: z.literal("reject_completion"), reason: text(5, 1000) })
      .strict(),
    z.object({ type: z.literal("pause"), reason: text(5, 1000) }).strict(),
    z.object({ type: z.literal("resume") }).strict(),
    z.object({ type: z.literal("archive") }).strict(),
    z.object({ type: z.literal("restore") }).strict(),
    z.object({ type: z.literal("delete"), reason: text(5, 1000) }).strict(),
    z
      .object({
        type: z.literal("respond_cancellation"),
        requestId: z.string().uuid(),
        accept: z.boolean(),
      })
      .strict(),
    z.object({ type: z.literal("withdraw_cancellation") }).strict(),
    z
      .object({
        type: z.literal("respond_appointment"),
        proposedAt: z.string().datetime(),
        accept: z.boolean(),
      })
      .strict(),
    z.object({ type: z.literal("cancel"), reason: text(5, 1000) }).strict(),
    z
      .object({
        type: z.literal("reschedule"),
        scheduledAt: z.string().datetime(),
      })
      .strict(),
    z.object({ type: z.literal("dispute"), reason: text(10, 2000) }).strict(),
  ])
  .superRefine((action, context) => {
    if (
      action.type === "quote" &&
      action.laborAmount + action.materialsAmount < 100
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimate total must be at least $1",
        path: ["laborAmount"],
      });
  });
export type ProjectAction = z.infer<typeof actionSchema>;
export function allowedTransition(
  project: Pick<
    Project,
    | "customerId"
    | "proId"
    | "status"
    | "pausedFrom"
    | "pausedBy"
    | "completionRequested"
    | "completionRequestedBy"
    | "cancellationRequestedBy"
  >,
  user: Pick<User, "id" | "role">,
  action: ProjectAction["type"],
) {
  const customer = user.role === "customer" && project.customerId === user.id,
    pro = user.role === "pro" && project.proId === user.id;
  if (action === "quote")
    return (
      user.role === "pro" &&
      (!project.proId || pro) &&
      ["requested", "quoted"].includes(project.status)
    );
  if (action === "withdraw_quote")
    return (
      user.role === "pro" &&
      (!project.proId || pro) &&
      ["requested", "quoted"].includes(project.status)
    );
  if (action === "accept" || action === "decline")
    return customer && ["requested", "quoted"].includes(project.status);
  const member = customer || pro;
  if (action === "archive" || action === "restore")
    return member && ["completed", "cancelled"].includes(project.status);
  if (action === "delete")
    return (
      customer &&
      !project.proId &&
      (["requested", "quoted"].includes(project.status) ||
        (project.status === "paused" &&
          ["requested", "quoted"].includes(project.pausedFrom || "")))
    );
  if (action === "respond_cancellation")
    return (
      member &&
      !!project.cancellationRequestedBy &&
      project.cancellationRequestedBy !== user.id &&
      ["in_progress", "paused"].includes(project.status)
    );
  if (action === "withdraw_cancellation")
    return member && project.cancellationRequestedBy === user.id;
  if (project.cancellationRequestedBy && action !== "dispute") return false;
  if (action === "pause")
    return (
      member &&
      ["requested", "quoted", "booked", "in_progress"].includes(project.status)
    );
  if (action === "resume")
    return (
      member && project.status === "paused" && project.pausedBy === user.id
    );
  if (action === "confirm_completion" || action === "reject_completion")
    return (
      member &&
      project.status === "in_progress" &&
      !!project.completionRequested &&
      (project.completionRequestedBy || project.proId) !== user.id
    );
  if (action === "respond_appointment")
    return (
      (customer || pro) &&
      ["requested", "quoted", "booked"].includes(project.status)
    );
  if (action === "start")
    return member && !!project.proId && project.status === "booked";
  if (action === "complete")
    return (
      member &&
      !!project.proId &&
      project.status === "in_progress" &&
      !project.completionRequested
    );
  if (action === "cancel")
    return (
      member &&
      ["requested", "quoted", "booked", "in_progress", "paused"].includes(
        project.status,
      )
    );
  if (action === "reschedule")
    return (
      (customer || pro) &&
      ["requested", "quoted", "booked"].includes(project.status)
    );
  return (
    action === "dispute" &&
    member &&
    ["in_progress", "paused", "completed"].includes(project.status)
  );
}
export function isMember(
  project: Pick<Project, "customerId" | "proId">,
  user: Pick<User, "id" | "role">,
) {
  return project.customerId === user.id || project.proId === user.id;
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
export function assertFuture(value: string | null) {
  if (
    value &&
    (!Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now())
  )
    throw new Error("Choose a future appointment time.");
}
