import type pg from "pg";
import { randomUUID } from "node:crypto";
import type { Project, ProjectAction, User } from "../shared/domain.js";
import { fail } from "./errors.js";
import {
  audit,
  notify,
  notifyAdministrators,
  getProject,
} from "./repository.js";
import {
  recordProjectActivity,
  notifyProjectMembers,
  notifyProjectObservers,
  notifyMatchingProfessionals,
} from "./project-events.js";

export const lifecycleActions = new Set<ProjectAction["type"]>([
  "start",
  "complete",
  "confirm_completion",
  "reject_completion",
  "pause",
  "resume",
  "cancel",
  "respond_cancellation",
  "withdraw_cancellation",
  "archive",
  "restore",
  "delete",
  "dispute",
]);

export async function changeLifecycle(
  c: pg.PoolClient,
  p: Project,
  user: User,
  action: ProjectAction,
) {
  const reason = "reason" in action ? action.reason : undefined;
  let title = "Project updated",
    closed = false;
  if (action.type === "archive" || action.type === "restore") {
    const changed =
      action.type === "archive"
        ? await c.query(
            "INSERT INTO project_archives(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING project_id",
            [p.id, user.id],
          )
        : await c.query(
            "DELETE FROM project_archives WHERE project_id=$1 AND user_id=$2 RETURNING project_id",
            [p.id, user.id],
          );
    if (!changed.rowCount) return;
    await audit(c, user.id, action.type, p.id);
    await notify(
      c,
      user.id,
      action.type === "archive" ? "Project archived" : "Project restored",
      "Only your project list changed. The other participant keeps their records.",
      { page: "project", id: p.id },
    );
    return;
  }
  if (action.type === "start") {
    title = "Work started";
    await c.query(
      "UPDATE projects SET status='in_progress',proposed_at=NULL,proposed_by=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "complete") {
    title = "Completion confirmation requested";
    await c.query(
      "UPDATE projects SET completion_requested=true,completion_requested_by=$2 WHERE id=$1",
      [p.id, user.id],
    );
  } else if (action.type === "confirm_completion") {
    title = "Project completed";
    await c.query(
      "UPDATE projects SET status='completed',completion_requested=false,completion_requested_by=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "reject_completion") {
    title = "More work requested";
    await c.query(
      "UPDATE projects SET completion_requested=false,completion_requested_by=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "pause") {
    title = "Project paused";
    await c.query(
      "UPDATE projects SET paused_from=status,status='paused',paused_by=$2,pause_reason=$3,completion_requested=false,completion_requested_by=NULL,proposed_at=NULL,proposed_by=NULL WHERE id=$1",
      [p.id, user.id, reason],
    );
  } else if (action.type === "resume") {
    if (!p.pausedFrom)
      fail(409, "The previous project state is unavailable. Contact support.");
    title = "Project resumed";
    await c.query(
      "UPDATE projects SET status=paused_from,paused_from=NULL,paused_by=NULL,pause_reason=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "cancel" || action.type === "delete") {
    const underway =
      p.status === "in_progress" ||
      (p.status === "paused" && p.pausedFrom === "in_progress");
    if (underway) {
      title = "Cancellation agreement requested";
      await c.query(
        "UPDATE projects SET cancellation_requested_by=$2,cancellation_reason=$3,cancellation_request_id=$4,completion_requested=false,completion_requested_by=NULL WHERE id=$1",
        [p.id, user.id, reason, randomUUID()],
      );
    } else {
      title = "Project cancelled";
      closed = true;
    }
    if (action.type === "delete")
      await c.query(
        "INSERT INTO project_archives(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [p.id, user.id],
      );
  } else if (action.type === "respond_cancellation") {
    if (action.requestId !== p.cancellationRequestId)
      fail(409, "This cancellation request changed. Refresh the project.");
    title = action.accept
      ? "Project cancelled by agreement"
      : "Cancellation declined";
    closed = action.accept;
    await c.query(
      "UPDATE projects SET cancellation_requested_by=NULL,cancellation_reason=NULL,cancellation_request_id=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "withdraw_cancellation") {
    title = "Cancellation request withdrawn";
    await c.query(
      "UPDATE projects SET cancellation_requested_by=NULL,cancellation_reason=NULL,cancellation_request_id=NULL WHERE id=$1",
      [p.id],
    );
  } else if (action.type === "dispute") {
    title = "Project issue reported";
    await c.query(
      "UPDATE projects SET previous_status=status,status='disputed',cancellation_requested_by=NULL,cancellation_reason=NULL,cancellation_request_id=NULL,completion_requested=false,completion_requested_by=NULL WHERE id=$1",
      [p.id],
    );
    await c.query(
      "INSERT INTO tickets(id,user_id,project_id,subject,body) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), user.id, p.id, "Project dispute: " + p.title, reason],
    );
    await notifyAdministrators(
      c,
      "Project issue needs review",
      "A participant opened a project issue. Review the support case.",
    );
  } else fail(400, "Unsupported project action.");
  if (closed) {
    await c.query(
      "UPDATE projects SET status='cancelled',paused_from=NULL,paused_by=NULL,pause_reason=NULL,scheduled_at=NULL,proposed_at=NULL,proposed_by=NULL,completion_requested=false,completion_requested_by=NULL,cancellation_requested_by=NULL,cancellation_reason=NULL,cancellation_request_id=NULL WHERE id=$1",
      [p.id],
    );
    await c.query(
      "UPDATE quotes SET status='declined' WHERE project_id=$1 AND status='pending'",
      [p.id],
    );
  }
  await c.query("UPDATE projects SET version=version+1 WHERE id=$1", [p.id]);
  await recordProjectActivity(c, p.id, user.id, action.type, title, reason);
  await audit(c, user.id, action.type, p.id);
  const updated = await getProject(c, p.id);
  await notifyProjectMembers(
    c,
    updated,
    title,
    p.title + ": " + (reason || "Open the project to see the update."),
  );
  if (!p.proId && (closed || action.type === "pause"))
    await notifyProjectObservers(c, updated, title);
  if (!p.proId && action.type === "resume")
    await notifyMatchingProfessionals(c, p.id, "Project available again");
}
