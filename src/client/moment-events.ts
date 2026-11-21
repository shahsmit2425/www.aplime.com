import type { Workspace } from "../shared/domain.js";
export type MomentKind =
  | "welcome"
  | "published"
  | "estimate-sent"
  | "estimate-received"
  | "selected"
  | "chosen"
  | "confirmed"
  | "appointment"
  | "started"
  | "resumed"
  | "wrap-up"
  | "completed"
  | "cancelled"
  | "paused"
  | "review-thanks"
  | "review-received"
  | "reply-sent"
  | "reply-received"
  | "verified"
  | "approved"
  | "submitted"
  | "thanks"
  | "support";
export type Moment = {
  // Identifies the event so the same moment is never shown twice.
  key: string;
  kind: MomentKind;
  title: string;
  body: string;
  action?: { label: string; page: string; id?: string };
};
const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
// Compares two snapshots of one account's workspace and names what just
// happened, whether the member did it or the other participant did.
export function workspaceMoments(previous: Workspace, next: Workspace) {
  if (previous.user.id !== next.user.id) return [];
  const me = next.user.id;
  const moments: Moment[] = [];
  const business = (proId: string | null) =>
    next.profiles.find((x) => x.id === proId)?.business || "your professional";
  const known = new Map(
    [...previous.projects, ...previous.leads].map((p) => [p.id, p]),
  );
  const projects = new Map(
    [...next.leads, ...next.projects].map((p) => [p.id, p]),
  );
  for (const p of next.projects) {
    const customer = p.customerId === me,
      pro = p.proId === me;
    if (!customer && !pro) continue;
    const was = known.get(p.id);
    // Publishing is announced by the project form itself.
    if (!was && !(pro && p.status === "booked")) continue;
    const key = (kind: string) => `${kind}:${p.id}:${p.version ?? p.status}`;
    const open = { label: "Open project", page: "project", id: p.id };
    const other = customer
      ? business(p.proId)
      : p.customerName || "The customer";
    const name = `“${p.title}”`;
    if (was?.status !== p.status) {
      if (p.status === "booked" && was?.status === "paused")
        moments.push({
          key: key("resumed"),
          kind: "resumed",
          title: "Project resumed",
          body: `${name} is moving again.`,
        });
      else if (p.status === "booked" && p.awardAccepted === false)
        moments.push(
          customer
            ? {
                key: key("selected"),
                kind: "selected",
                title: "Estimate selected",
                body: `We asked ${other} to confirm the job before work starts.`,
              }
            : {
                key: key("chosen"),
                kind: "chosen",
                title: "You’ve been chosen!",
                body: `${other} selected your estimate for ${name}. Confirm the job to get started.`,
                action: open,
              },
        );
      else if (p.status === "booked")
        moments.push({
          key: key("confirmed"),
          kind: "confirmed",
          title: "Job confirmed",
          body: "Agree on the appointment next.",
        });
      else if (p.status === "in_progress")
        moments.push(
          was?.status === "paused"
            ? {
                key: key("resumed"),
                kind: "resumed",
                title: "Project resumed",
                body: `${name} is moving again.`,
              }
            : {
                key: key("started"),
                kind: "started",
                title: "Work has started",
                body: `${name} is now in progress.`,
              },
        );
      else if (p.status === "completed") {
        const reviewed = next.reviews.some((r) => r.projectId === p.id);
        moments.push({
          key: key("completed"),
          kind: "completed",
          title: "Congratulations — project completed!",
          body: customer
            ? reviewed || !p.proId
              ? `${name} is finished.`
              : `${name} is finished. How did it go with ${other}?`
            : `${name} is finished. ${other} can now leave a review.`,
          ...(customer && p.proId && !reviewed
            ? {
                action: {
                  label: "Leave a review",
                  page: "reviews",
                  id: p.id,
                },
              }
            : {}),
        });
      } else if (p.status === "cancelled")
        moments.push({
          key: key("cancelled"),
          kind: "cancelled",
          title: "Project cancelled",
          body: `${name} is closed. Your messages and records stay available.`,
        });
      else if (p.status === "paused")
        moments.push({
          key: key("paused"),
          kind: "paused",
          title: "Project paused",
          body: "Work actions are on hold until the project is resumed.",
        });
      else if (p.status === "disputed")
        moments.push({
          key: key("support"),
          kind: "support",
          title: "Issue reported",
          body: "Our support team will review it and follow up with you both.",
        });
      continue;
    }
    if (!was) continue;
    if (was.awardAccepted === false && p.awardAccepted !== false)
      moments.push({
        key: key("confirmed"),
        kind: "confirmed",
        title: "Job confirmed",
        body: customer
          ? `${other} confirmed your job. Agree on the appointment next.`
          : "Agree on the appointment with your customer next.",
      });
    else if (
      p.status === "in_progress" &&
      !was.completionRequested &&
      p.completionRequested
    )
      moments.push(
        p.completionRequestedBy === me
          ? {
              key: key("wrap-up"),
              kind: "wrap-up",
              title: "Completion requested",
              body: `We asked ${other} to confirm that the work is finished.`,
            }
          : {
              key: key("wrap-up"),
              kind: "wrap-up",
              title: "Ready to wrap up?",
              body: `${other} marked ${name} as finished. Confirm completion or request more work.`,
              action: open,
            },
      );
    else if (
      p.scheduledAt &&
      p.scheduledAt !== was.scheduledAt &&
      ["requested", "quoted", "booked"].includes(p.status)
    )
      moments.push({
        key: key("appointment"),
        kind: "appointment",
        title: "Appointment confirmed",
        body: `${when(p.scheduledAt)} for ${name}.`,
      });
  }
  const estimates = new Map(previous.quotes.map((q) => [q.id, q]));
  for (const q of next.quotes) {
    const was = estimates.get(q.id);
    if (was && was.revision === q.revision) continue;
    const project = projects.get(q.projectId);
    const name = `“${q.projectTitle || project?.title || "your project"}”`;
    if (q.proId === me)
      moments.push({
        key: `estimate-sent:${q.id}:${q.revision}`,
        kind: "estimate-sent",
        title: was ? "Estimate updated" : "Estimate sent",
        body: `Your estimate for ${name} is with the customer.`,
      });
    else if (project?.customerId === me && q.status === "pending")
      moments.push({
        key: `estimate-received:${q.id}:${q.revision}`,
        kind: "estimate-received",
        title: was ? "Estimate updated" : "New estimate received",
        body: `${business(q.proId)} sent an estimate for ${name}.`,
        action: { label: "View estimate", page: "project", id: q.projectId },
      });
  }
  const reviews = new Map(previous.reviews.map((r) => [r.id, r]));
  for (const r of next.reviews) {
    const was = reviews.get(r.id);
    const read = { label: "Read it", page: "reviews" };
    if (!was)
      moments.push(
        r.proId === me
          ? {
              key: `review-received:${r.id}`,
              kind: "review-received",
              title: "You received a new review",
              body: `A customer rated ${projects.get(r.projectId)?.title ? `“${projects.get(r.projectId)!.title}”` : "a completed project"} ${r.rating} out of 5.`,
              action: read,
            }
          : {
              key: `review-thanks:${r.id}`,
              kind: "review-thanks",
              title: "Thank you for your review!",
              body: `Your review of ${business(r.proId)} is now public and helps other customers choose.`,
            },
      );
    else if (!was.reply && r.reply)
      moments.push(
        r.proId === me
          ? {
              key: `reply-sent:${r.id}`,
              kind: "reply-sent",
              title: "Response published",
              body: "Your response now appears with the review on your profile.",
            }
          : {
              key: `reply-received:${r.id}`,
              kind: "reply-received",
              title: "You have a response",
              body: `${business(r.proId)} responded to your review.`,
              action: read,
            },
      );
  }
  const profile = next.profiles.find((x) => x.id === me),
    before = previous.profiles.find((x) => x.id === me);
  if (profile && before) {
    if (!before.verified && profile.verified)
      moments.push({
        key: `verified:${me}`,
        kind: "verified",
        title: "Identity verified",
        body: "Your business profile now shows that your identity is verified.",
      });
    if (before.reviewStatus !== profile.reviewStatus) {
      if (profile.reviewStatus === "approved")
        moments.push({
          key: `approved:${me}:${profile.reviewedAt ?? ""}`,
          kind: "approved",
          title: "Congratulations — your business is approved!",
          body: "Aplime approved your business profile.",
          action: { label: "View my business", page: "profile" },
        });
      else if (profile.reviewStatus === "pending")
        moments.push({
          key: `submitted:${me}:${profile.submittedAt ?? ""}`,
          kind: "submitted",
          title: "Submitted for review",
          body: "We’ll notify you as soon as your business profile has been reviewed.",
        });
    }
  }
  return moments.slice(0, 3);
}
