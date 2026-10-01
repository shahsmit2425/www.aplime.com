import { randomUUID } from "node:crypto";
import type { User, ProjectAction } from "../shared/domain.js";
import { allowedTransition, assertFuture } from "../shared/domain.js";
import { transaction } from "./db/index.js";
import { getProject, notify, audit } from "./repository.js";
import { fail } from "./errors.js";
export async function projectAction(
  id: string,
  user: User,
  action: ProjectAction,
) {
  return transaction(async (c) => {
    const p = await getProject(c, id);
    if (!allowedTransition(p, user, action.type))
      fail(403, "This action is not available for this project.");
    if (action.type === "quote") {
      const profile = (
        await c.query(
          "SELECT * FROM profiles WHERE id=$1 AND verified AND NOT suspended AND available",
          [user.id],
        )
      ).rows[0];
      if (!profile || profile.category !== p.category)
        fail(403, "Complete verification and use a matching service category.");
      if (
        (
          await c.query(
            "SELECT 1 FROM quotes WHERE project_id=$1 AND pro_id=$2",
            [id, user.id],
          )
        ).rowCount
      )
        fail(409, "You have already submitted an estimate.");
      await c.query(
        "INSERT INTO quotes(id,project_id,pro_id,amount,description) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, user.id, action.amount, action.description],
      );
      await c.query("UPDATE projects SET status='quoted' WHERE id=$1", [id]);
    } else if (action.type === "accept" || action.type === "decline") {
      const quote = (
        await c.query(
          "SELECT q.* FROM quotes q JOIN profiles f ON f.id=q.pro_id WHERE q.id=$1 AND q.project_id=$2 AND q.status='pending' AND f.verified AND NOT f.suspended",
          [action.quoteId, id],
        )
      ).rows[0];
      if (!quote) fail(409, "This estimate is no longer available.");
      if (action.type === "accept") {
        await c.query(
          "UPDATE quotes SET status=CASE WHEN id=$1 THEN 'accepted' ELSE 'declined' END WHERE project_id=$2",
          [quote.id, id],
        );
        await c.query(
          "UPDATE projects SET status='booked',pro_id=$2,amount=$3 WHERE id=$1",
          [id, quote.pro_id, quote.amount],
        );
        await notify(
          c,
          quote.pro_id,
          "Estimate accepted",
          "Your estimate for " + p.title + " has been accepted.",
        );
      } else {
        await c.query("UPDATE quotes SET status='declined' WHERE id=$1", [
          quote.id,
        ]);
        await c.query(
          "UPDATE projects SET status=CASE WHEN EXISTS(SELECT 1 FROM quotes WHERE project_id=$1 AND status='pending') THEN 'quoted' ELSE 'requested' END WHERE id=$1",
          [id],
        );
      }
    } else if (action.type === "reschedule") {
      assertFuture(action.scheduledAt);
      await c.query("UPDATE projects SET scheduled_at=$2 WHERE id=$1", [
        id,
        action.scheduledAt,
      ]);
    } else if (action.type === "dispute") {
      await c.query(
        "UPDATE projects SET previous_status=status,status='disputed' WHERE id=$1",
        [id],
      );
      await c.query(
        "INSERT INTO tickets(id,user_id,project_id,subject,body) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          user.id,
          id,
          "Project dispute: " + p.title,
          action.reason,
        ],
      );
    } else {
      await c.query("UPDATE projects SET status=$2 WHERE id=$1", [
        id,
        action.type === "start"
          ? "in_progress"
          : action.type === "complete"
            ? "completed"
            : "cancelled",
      ]);
      if (action.type === "cancel")
        await c.query(
          "UPDATE quotes SET status='declined' WHERE project_id=$1 AND status='pending'",
          [id],
        );
    }
    await audit(c, user.id, action.type, id);
    await notify(
      c,
      user.id === p.customerId ? p.proId : p.customerId,
      "Project update",
      p.title + " has an update. Open Aplime for details.",
    );
    return { ok: true };
  });
}
