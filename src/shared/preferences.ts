import { z } from "zod";
import { categories } from "./service-questionnaires.js";

export const weekdays = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const weeklyHoursSchema = z
  .record(
    z.enum(weekdays),
    z
      .object({
        start: time,
        end: time,
      })
      .strict(),
  )
  .superRefine((hours, ctx) => {
    for (const [day, range] of Object.entries(hours))
      if (range.start >= range.end)
        ctx.addIssue({
          code: "custom",
          path: [day],
          message: "End time must follow start time.",
        });
  });
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;
export const preferencesSchema = z
  .object({
    serviceCategories: z
      .array(z.enum(categories))
      .min(1)
      .max(categories.length),
    serviceRadiusMiles: z.number().int().min(1).max(100),
    available: z.boolean(),
    weeklyHours: weeklyHoursSchema,
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: value });
          return !!value;
        } catch {
          return false;
        }
      }, "Choose a valid IANA time zone."),
  })
  .strict();

export function withinWeeklyHours(
  value: string,
  hours: WeeklyHours,
  timeZone: string,
) {
  if (!Number.isFinite(Date.parse(value))) return false;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  const range = hours[parts.weekday as keyof WeeklyHours];
  const time = parts.hour + ":" + parts.minute;
  return !!range && time >= range.start && time < range.end;
}
