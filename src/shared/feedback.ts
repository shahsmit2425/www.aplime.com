import { z } from "zod";
export const feedbackPages = [
  "home",
  "services",
  "project",
  "dashboard",
  "messages",
  "schedule",
  "professionals",
  "account",
  "other",
] as const;
export const feedbackSchema = z
  .object({
    id: z.string().uuid(),
    category: z.enum(["suggestion", "problem", "other"]),
    message: z
      .string()
      .trim()
      .min(10, "Please enter at least 10 characters.")
      .max(2000),
    email: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .default(""),
    page: z.enum(feedbackPages),
    website: z.string().max(200).default(""),
  })
  .strict();
export function feedbackPage(
  pathname: string,
  hash: string,
): (typeof feedbackPages)[number] {
  const route = hash.replace(/^#\/?/, "").split("/")[0];
  if (["project", "projects"].includes(route)) return "project";
  if (["dashboard", "messages", "schedule"].includes(route))
    return route as "dashboard" | "messages" | "schedule";
  if (pathname.startsWith("/app") || route) return "account";
  if (pathname === "/") return "home";
  if (pathname.startsWith("/services")) return "services";
  if (pathname.startsWith("/professionals")) return "professionals";
  return "other";
}
