import { changeLifecycle, lifecycleActions } from "./project-lifecycle.js";
import {
  recordProjectActivity,
  notifyProjectMembers,
  notifyProjectObservers,
} from "./project-events.js";
import { assertMatch } from "./matching.js";
import { assertAppointment } from "./scheduling.js";
import { randomUUID } from "node:crypto";
import type { User, ProjectAction } from "../shared/domain.js";
import { allowedTransition, assertFuture } from "../shared/domain.js";
import { transaction } from "./db/index.js";
import { getProject, audit } from "./repository.js";
import { fail } from "./errors.js";
export async function projectAction(
  id: string,
  user: User,
  action: ProjectAction,
  expectedVersion?: number,
) {
  return transaction(async (c) => {
    const p = await getProject(c, id);
    if (!allowedTransition(p, user, action.type))
      fail(403, "This action is not available for this project.");
    if (expectedVersion !== undefined && expectedVersion !== p.version)
      fail(409, "This project changed. Refresh it before trying again.");
    if (lifecycleActions.has(action.type)) {
      await changeLifecycle(c, p, user, action);
      return { ok: true };
    }
    let extraRecipient: string | undefined;
    if (action.type === "quote") {
      extraRecipient = user.id;
      await assertMatch(c, user.id, id);
      if (
        !(
          await c.query(
            "SELECT 1 FROM professional_subscriptions WHERE user_id=$1 AND status IN ('active','trialing')",
            [user.id],
          )
        ).rowCount
      )
        fail(
          403,
          "An active Aplime subscription is required for new estimates.",
        );
      const profile = (
        await c.query(
          "SELECT 1 FROM profiles WHERE id=$1 AND verified AND review_status='approved' AND NOT suspended AND available",
          [user.id],
        )
      ).rows[0];
      if (!profile)
        fail(403, "An approved and available business profile is required.");
      const existing = (
        await c.query(
          "SELECT status FROM quotes WHERE project_id=$1 AND pro_id=$2",
          [id, user.id],
        )
      ).rows[0];
      if (existing && !["pending", "withdrawn"].includes(existing.status))
        fail(409, "This estimate is closed.");
      const amount = action.laborAmount + action.materialsAmount;
      if (action.expiresAt) assertFuture(action.expiresAt);
      await c.query(
        "INSERT INTO quotes(id,project_id,pro_id,amount,labor_amount,materials_amount,description,exclusions,timeline,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(project_id,pro_id) DO UPDATE SET status='pending',amount=EXCLUDED.amount,labor_amount=EXCLUDED.labor_amount,materials_amount=EXCLUDED.materials_amount,description=EXCLUDED.description,exclusions=EXCLUDED.exclusions,timeline=EXCLUDED.timeline,expires_at=EXCLUDED.expires_at,created_at=now(),revision=quotes.revision+1",
        [
          randomUUID(),
          id,
          user.id,
          amount,
          action.laborAmount,
          action.materialsAmount,
          action.description,
          action.exclusions,
          action.timeline,
          action.expiresAt,
        ],
      );
      await c.query(
        "INSERT INTO project_discussions(id,project_id,pro_id) VALUES($1,$2,$3) ON CONFLICT(project_id,pro_id) DO NOTHING",
        [randomUUID(), id, user.id],
      );
      await c.query("UPDATE projects SET status='quoted' WHERE id=$1", [id]);
    } else if (action.type === "withdraw_quote") {
      const changed = await c.query(
        "UPDATE quotes SET status='withdrawn',revision=revision+1 WHERE project_id=$1 AND pro_id=$2 AND status='pending' RETURNING id",
        [id, user.id],
      );
      if (!changed.rowCount)
        fail(409, "There is no pending estimate to withdraw.");
      extraRecipient = user.id;
      await c.query(
        "UPDATE projects SET status=CASE WHEN EXISTS(SELECT 1 FROM quotes WHERE project_id=$1 AND status='pending') THEN 'quoted' ELSE 'requested' END WHERE id=$1",
        [id],
      );
    } else if (action.type === "accept" || action.type === "decline") {
      const quote = (
        await c.query(
          "SELECT q.* FROM quotes q JOIN profiles f ON f.id=q.pro_id WHERE q.id=$1 AND q.project_id=$2 AND q.status='pending' AND (q.expires_at IS NULL OR q.expires_at>now()) AND f.verified AND f.review_status='approved' AND NOT f.suspended",
          [action.quoteId, id],
        )
      ).rows[0];
      if (!quote) fail(409, "This estimate is no longer available.");
      extraRecipient = quote.pro_id;
      if (action.type === "accept") {
        if (quote.revision !== action.revision)
          fail(
            409,
            "This estimate changed. Review the latest version before accepting.",
          );
        await c.query(
          "UPDATE quotes SET status=CASE WHEN id=$1 THEN 'accepted' ELSE 'declined' END WHERE project_id=$2",
          [quote.id, id],
        );
        await c.query(
          "UPDATE projects SET status='booked',pro_id=$2,amount=$3 WHERE id=$1",
          [id, quote.pro_id, quote.amount],
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
    } else if (action.type === "respond_appointment") {
      if (
        !p.proposedAt ||
        p.proposedBy === user.id ||
        new Date(p.proposedAt).getTime() !==
          new Date(action.proposedAt).getTime()
      )
        fail(
          409,
          "This appointment proposal is unavailable or cannot be confirmed by you.",
        );
      if (action.accept) {
        assertFuture(p.proposedAt);
        await assertAppointment(c, p.proId, p.proposedAt, id);
      }
      await c.query(
        "UPDATE projects SET scheduled_at=CASE WHEN $2 THEN proposed_at ELSE scheduled_at END,proposed_at=NULL,proposed_by=NULL WHERE id=$1",
        [id, action.accept],
      );
    } else if (action.type === "reschedule") {
      assertFuture(action.scheduledAt);
      await assertAppointment(c, p.proId, action.scheduledAt, id);
      await c.query(
        "UPDATE projects SET proposed_at=$2,proposed_by=$3 WHERE id=$1",
        [id, action.scheduledAt, user.id],
      );
    } else fail(400, "Unsupported project action.");
    await c.query("UPDATE projects SET version=version+1 WHERE id=$1", [id]);
    const titles: Record<string, string> = {
      quote: "Estimate received or updated",
      accept: "Estimate accepted",
      decline: "Estimate declined",
      withdraw_quote: "Estimate withdrawn",
      reschedule: "Appointment proposed",
      respond_appointment:
        action.type === "respond_appointment" && action.accept
          ? "Appointment confirmed"
          : "Appointment proposal declined",
    };
    const title = titles[action.type];
    await recordProjectActivity(
      c,
      id,
      user.id,
      action.type,
      title,
      "reason" in action ? action.reason : undefined,
    );
    await audit(c, user.id, action.type, id);
    const updated = await getProject(c, id);
    await notifyProjectMembers(
      c,
      updated,
      title,
      p.title + ": open the project for the update.",
      extraRecipient ? [extraRecipient] : [],
    );
    if (action.type === "accept")
      await notifyProjectObservers(c, updated, "Project awarded");
    return { ok: true };
  });
}
