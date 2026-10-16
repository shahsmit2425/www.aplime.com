export const emailCategories = {
  projects: "Projects and estimates",
  messages: "Unread messages",
  meetings: "Meetings and visit reminders",
  business: "Business profile and identity",
  reviews: "Reviews and feedback",
  support: "Support updates",
} as const;
export type EmailCategory =
  keyof typeof emailCategories | "billing" | "security";
export type EmailTarget = { page: string; id?: string };

export function emailPolicy(
  title: string,
  target: EmailTarget = { page: "notifications" },
) {
  const category: EmailCategory =
    /password|email address|devices|account deleted|account restricted|account restored/i.test(
      title,
    )
      ? "security"
      : /subscription|membership|payment|invoice|refund/i.test(title) ||
          target.page === "subscription"
        ? "billing"
        : /support|cleanup needs attention/i.test(title) ||
            target.page === "support"
          ? "support"
          : /call|meeting|appointment|visit/i.test(title) ||
              target.page === "schedule"
            ? "meetings"
            : (/review/i.test(title) && target.page === "reviews") ||
                title === "How was your professional?"
              ? "reviews"
              : /business|identity|profile/i.test(title) ||
                  ["profile", "verification", "availability"].includes(
                    target.page,
                  )
                ? "business"
                : title === "New message"
                  ? "messages"
                  : "projects";
  return {
    category,
    essential:
      category === "security" ||
      category === "billing" ||
      /Aplime support|suspended|restored|cleanup needs attention/i.test(title),
    muted: [
      "Preferences updated",
      "Project archived",
      "Project restored",
      "Call meeting completed",
    ].includes(title),
    grouped: title === "New message",
  };
}
export function emailAllowed(
  settings: Record<string, any>,
  category: EmailCategory,
  essential: boolean,
) {
  return (
    essential ||
    (settings.emailAlerts !== false &&
      settings.emailCategories?.[category] !== false)
  );
}
