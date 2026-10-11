import { pool } from "./db/index.js";

export async function closeDueMeetings(participant?: string) {
  await pool.query("SELECT close_due_call_meetings($1)", [participant || null]);
}
