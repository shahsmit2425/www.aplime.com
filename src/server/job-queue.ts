import type { Queue } from "pg-boss";

export const jobQueues = [
  "email-delivery",
  "email-reminders",
  "meeting-lifecycle",
  "estimate-expiry",
  "storage-cleanup",
  "account-cleanup",
] as const;
// Each maintenance task is a singleton across workers, including while retrying.
export const jobQueueOptions = {
  policy: "exclusive",
  retryLimit: 5,
  retryDelay: 10,
  retryBackoff: true,
  expireInSeconds: 900,
} satisfies Omit<Queue, "name">;
