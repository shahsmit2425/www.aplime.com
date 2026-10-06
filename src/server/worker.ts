import { pool } from "./db/index.js";
import { sendEmail } from "./integrations/email.js";
import { env, validateMailWorker } from "./config.js";
import { deliverOutbox } from "./outbox.js";
import { expireEstimates } from "./estimates.js";
if (env.NODE_ENV === "production") validateMailWorker();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
  });
const batch = 20;
while (!stopping) {
  try {
    await expireEstimates();
    while (!stopping && (await deliverOutbox(sendEmail, batch)) === batch);
  } catch {
    console.error("Background worker could not reach the database.");
  }
  await new Promise((r) => setTimeout(r, 3000));
}
await pool.end();
