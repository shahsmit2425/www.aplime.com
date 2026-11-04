import { env } from "./config.js";
let capture: ((stage: string) => void) | undefined;

export async function startWorkerMonitoring() {
  if (!env.SENTRY_DSN) return;
  const sentry = await import("@sentry/node");
  sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      return event;
    },
  });
  capture = (stage) =>
    sentry.captureMessage("Worker failure: " + stage, {
      level: "error",
      tags: { component: "worker", job: stage },
    });
}

export function reportWorkerFailure(stage: string) {
  capture?.(stage);
}
