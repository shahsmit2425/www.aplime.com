import { startWorkerMonitoring } from "./worker-monitor.js";
import { env, validateMailWorker } from "./config.js";
await startWorkerMonitoring();
if (env.NODE_ENV === "production") validateMailWorker();
if (env.JOBS_ENGINE === "legacy") await import("./legacy-worker.js");
else {
  const { startJobWorker } = await import("./job-worker.js");
  await startJobWorker();
}
