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
  details?: BusinessDetails;
};
export const statuses = [
  "requested",
  "quoted",
  "booked",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type Status = (typeof statuses)[number];
export type Project = {
  id: string;
  customerId: string;
  proId: string | null;
  title: string;
  description: string;
  intake?: Record<string, string>;
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
  description: string;
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
    zip: z.string().regex(/^\d{5}$/, "Enter a five-digit ZIP code"),
    rate: z.number().min(1).max(10000),
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
    zip: z.string().regex(/^\d{5}$/),
    proId: z.string().min(1).max(128).nullable().default(null),
    scheduledAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine((project, context) => {
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
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("quote"),
      amount: z.number().int().min(100).max(10000000),
      description: text(10, 2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("accept"),
      quoteId: z.string().uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
  z.object({ type: z.literal("decline"), quoteId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("complete") }).strict(),
  z.object({ type: z.literal("confirm_completion") }).strict(),
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
]);
export type ProjectAction = z.infer<typeof actionSchema>;
export function allowedTransition(
  project: Pick<Project, "customerId" | "proId" | "status">,
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
  if (action === "accept" || action === "decline")
    return customer && ["requested", "quoted"].includes(project.status);
  if (action === "confirm_completion")
    return customer && project.status === "in_progress";
  if (action === "respond_appointment")
    return (
      (customer || pro) &&
      ["requested", "quoted", "booked"].includes(project.status)
    );
  if (action === "start") return pro && project.status === "booked";
  if (action === "complete") return pro && project.status === "in_progress";
  if (action === "cancel" || action === "reschedule")
    return (
      (customer || pro) &&
      ["requested", "quoted", "booked"].includes(project.status)
    );
  return (
    (customer || pro) && ["in_progress", "completed"].includes(project.status)
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
