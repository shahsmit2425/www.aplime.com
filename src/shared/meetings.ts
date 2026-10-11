import { z } from "zod";
export const CALL_MINUTES = 10;
export const CALL_HORIZON_DAYS = 21;
export type CallMeeting = {
  id: string;
  projectId: string;
  customerId: string;
  proId: string;
  title: string;
  business: string;
  customerName: string;
  startsAt: string;
  mode: "audio" | "video";
  status: "requested" | "confirmed" | "declined" | "cancelled" | "completed";
  proposedAt: string | null;
  proposedBy: string | null;
  version: number;
  note: string;
};
export type CallSlots = { slots: string[]; timeZone: string; minutes: number };
export const callRequestSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    proId: z.string().min(1).max(128),
    startsAt: z.string().datetime(),
    mode: z.enum(["audio", "video"]),
  })
  .strict();
export const callActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("respond"),
      accept: z.boolean(),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("reschedule"),
      startsAt: z.string().datetime(),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("cancel"),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("complete"),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
]);
export function callCanJoin(
  m: Pick<CallMeeting, "startsAt" | "status">,
  now = Date.now(),
) {
  const start = Date.parse(m.startsAt);
  return (
    m.status === "confirmed" &&
    now >= start &&
    now < start + CALL_MINUTES * 60000
  );
}
export function callIsActive(
  m: Pick<CallMeeting, "startsAt" | "status" | "proposedAt">,
  now = Date.now(),
) {
  return m.status === "confirmed"
    ? now < Date.parse(m.startsAt) + CALL_MINUTES * 60000
    : m.status === "requested";
}
