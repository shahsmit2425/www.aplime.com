import { randomUUID } from "node:crypto";
import type { User, ProjectAction } from "../shared/domain.js";
import { allowedTransition, assertFuture } from "../shared/domain.js";
import { transaction } from "./db/index.js";
import {
  getProject,
  notify,
  audit,
  notifyAdministrators,
} from "./repository.js";
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
          "SELECT * FROM profiles WHERE id=$1 AND verified AND review_status='approved' AND NOT suspended AND available AND ((latitude IS NOT NULL AND $2::float8 IS NOT NULL AND 3959 * acos(least(1,cos(radians(latitude))*cos(radians($2))*cos(radians($3)-radians(longitude))+sin(radians(latitude))*sin(radians($2)))) <= service_radius_miles) OR ((latitude IS NULL OR $2::float8 IS NULL) AND zip=$4))",
          [user.id, p.latitude, p.longitude, p.zip],
        )
      ).rows[0];
      if (!profile || profile.category !== p.category)
        fail(403, "Complete verification and use a matching service category.");
      const existing = (
        await c.query(
          "SELECT status FROM quotes WHERE project_id=$1 AND pro_id=$2",
          [id, user.id],
        )
      ).rows[0];
      if (existing && existing.status !== "pending")
        fail(409, "This estimate is closed.");
      const amount = action.laborAmount + action.materialsAmount;
      if (action.expiresAt) assertFuture(action.expiresAt);
      await c.query(
        "INSERT INTO quotes(id,project_id,pro_id,amount,labor_amount,materials_amount,description,exclusions,timeline,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(project_id,pro_id) DO UPDATE SET amount=EXCLUDED.amount,labor_amount=EXCLUDED.labor_amount,materials_amount=EXCLUDED.materials_amount,description=EXCLUDED.description,exclusions=EXCLUDED.exclusions,timeline=EXCLUDED.timeline,expires_at=EXCLUDED.expires_at,created_at=now(),revision=quotes.revision+1",
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
    } else if (action.type === "accept" || action.type === "decline") {
      const quote = (
        await c.query(
          "SELECT q.* FROM quotes q JOIN profiles f ON f.id=q.pro_id WHERE q.id=$1 AND q.project_id=$2 AND q.status='pending' AND (q.expires_at IS NULL OR q.expires_at>now()) AND f.verified AND f.review_status='approved' AND NOT f.suspended",
          [action.quoteId, id],
        )
      ).rows[0];
      if (!quote) fail(409, "This estimate is no longer available.");
      if (action.type === "decline")
        await notify(
          c,
          quote.pro_id,
          "Estimate declined",
          p.title + ": the customer declined your estimate.",
          { page: "messages", id },
        );
      if (action.type === "accept") {
        if (quote.revision !== action.revision)
          fail(
            409,
            "This estimate changed. Review the latest version before accepting.",
          );
        const others = (
          await c.query(
            "SELECT pro_id FROM quotes WHERE project_id=$1 AND id<>$2 AND status='pending'",
            [id, quote.id],
          )
        ).rows;
        for (const other of others)
          await notify(
            c,
            other.pro_id,
            "Project awarded",
            p.title + ": the customer selected another professional.",
            { page: "messages", id },
          );
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
          { page: "project", id },
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
    } else if (action.type === "complete") {
      if (p.completionRequested)
        fail(409, "Completion has already been requested.");
      await c.query(
        "UPDATE projects SET completion_requested=true WHERE id=$1",
        [id],
      );
    } else if (action.type === "confirm_completion") {
      if (!p.completionRequested)
        fail(409, "Wait for the professional to request completion.");
      await c.query(
        "UPDATE projects SET status='completed',completion_requested=false WHERE id=$1",
        [id],
      );
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
      if (action.accept) assertFuture(p.proposedAt);
      await c.query(
        "UPDATE projects SET scheduled_at=CASE WHEN $2 THEN proposed_at ELSE scheduled_at END,proposed_at=NULL,proposed_by=NULL WHERE id=$1",
        [id, action.accept],
      );
    } else if (action.type === "reschedule") {
      assertFuture(action.scheduledAt);
      await c.query(
        "UPDATE projects SET proposed_at=$2,proposed_by=$3 WHERE id=$1",
        [id, action.scheduledAt, user.id],
      );
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
        action.type === "start" ? "in_progress" : "cancelled",
      ]);
      if (action.type === "cancel")
        await c.query(
          "UPDATE quotes SET status='declined' WHERE project_id=$1 AND status='pending'",
          [id],
        );
    }
    if (action.type === "dispute")
      await notifyAdministrators(
        c,
        "Project issue needs review",
        "A project participant opened a support case. Review it in the administrator console.",
      );
    await audit(c, user.id, action.type, id);
    const titles: Record<string, string> = {
      quote: "Estimate received or updated",
      reschedule: "Appointment proposed",
      respond_appointment:
        action.type === "respond_appointment" && action.accept
          ? "Appointment confirmed"
          : "Appointment proposal declined",
      start: "Work started",
      complete: "Please confirm completed work",
      confirm_completion: "Project completed",
      cancel: "Project cancelled",
      dispute: "Project issue reported",
    };
    if (titles[action.type])
      await notify(
        c,
        user.id === p.customerId ? p.proId : p.customerId,
        titles[action.type],
        p.title + ": open the project to see the update.",
        { page: "project", id },
      );
    if (action.type === "cancel" && !p.proId) {
      const others = (
        await c.query(
          "SELECT pro_id FROM project_discussions WHERE project_id=$1",
          [id],
        )
      ).rows;
      for (const other of others)
        await notify(
          c,
          other.pro_id,
          "Project cancelled",
          p.title + ": the customer cancelled this request.",
          { page: "messages", id },
        );
    }
    return { ok: true };
  });
}
