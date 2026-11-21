import test from "node:test";
import assert from "node:assert/strict";
import { workspaceMoments } from "../src/client/moment-events.js";
import {
  closedProject,
  statuses,
  type Profile,
  type Project,
  type Quote,
  type Review,
  type Workspace,
} from "../src/shared/domain.js";
const customer = { id: "customer", role: "customer" } as Workspace["user"];
const pro = { id: "pro", role: "pro" } as Workspace["user"];
const profile = {
  id: "pro",
  business: "Bright Painting",
  verified: false,
  reviewStatus: "draft",
} as Profile;
const project = {
  id: "job",
  customerId: "customer",
  proId: "pro",
  title: "Paint the hallway",
  status: "in_progress",
  version: 4,
} as Project;
const review = {
  id: "review",
  projectId: "job",
  proId: "pro",
  rating: 5,
  body: "Careful work",
  reply: null,
} as Review;
const quote = {
  id: "quote",
  projectId: "job",
  proId: "pro",
  status: "pending",
  revision: 1,
} as Quote;
const view = (
  user: Workspace["user"],
  parts: Partial<Workspace> = {},
): Workspace =>
  ({
    user,
    profiles: [profile],
    projects: [project],
    leads: [],
    quotes: [],
    reviews: [],
    ...parts,
  }) as Workspace;
const kinds = (previous: Workspace, next: Workspace) =>
  workspaceMoments(previous, next).map((m) => m.kind);

test("only finished and cancelled projects are closed to edits", () => {
  assert.deepEqual(statuses.filter(closedProject).sort(), [
    "cancelled",
    "completed",
  ]);
});

test("an unchanged workspace and a different account raise no moments", () => {
  assert.deepEqual(workspaceMoments(view(customer), view(customer)), []);
  assert.deepEqual(
    workspaceMoments(
      view(customer),
      view(pro, { projects: [{ ...project, status: "completed" }] }),
    ),
    [],
  );
});

test("completing a project congratulates both sides and invites only the customer to review", () => {
  const done = { projects: [{ ...project, status: "completed" as const }] };
  const [mine] = workspaceMoments(view(customer), view(customer, done));
  assert.equal(mine.kind, "completed");
  assert.match(mine.title, /Congratulations/);
  assert.match(mine.body, /Bright Painting/);
  assert.deepEqual(mine.action, {
    label: "Leave a review",
    page: "reviews",
    id: "job",
  });
  const [theirs] = workspaceMoments(view(pro), view(pro, done));
  assert.equal(theirs.kind, "completed");
  assert.equal(theirs.action, undefined);
  const [reviewed] = workspaceMoments(
    view(customer),
    view(customer, { ...done, reviews: [review] }),
  );
  assert.equal(reviewed.action, undefined);
});

test("each project change gets its own moment, and quiet ones stay calm", () => {
  const to = (status: Project["status"], extra: Partial<Project> = {}) =>
    view(customer, { projects: [{ ...project, status, ...extra }] });
  assert.deepEqual(kinds(view(customer), to("cancelled")), ["cancelled"]);
  assert.deepEqual(kinds(view(customer), to("paused")), ["paused"]);
  assert.deepEqual(kinds(view(customer), to("disputed")), ["support"]);
  assert.deepEqual(kinds(to("paused"), view(customer)), ["resumed"]);
  assert.deepEqual(kinds(to("booked"), view(customer)), ["started"]);
  assert.deepEqual(
    kinds(to("quoted"), to("booked", { awardAccepted: false })),
    ["selected"],
  );
  assert.deepEqual(
    kinds(
      to("booked", { awardAccepted: false }),
      to("booked", { awardAccepted: true }),
    ),
    ["confirmed"],
  );
  assert.deepEqual(
    kinds(
      to("booked"),
      to("booked", { scheduledAt: "2026-12-01T15:00:00.000Z" }),
    ),
    ["appointment"],
  );
  const [asked] = workspaceMoments(
    view(customer),
    to("in_progress", {
      completionRequested: true,
      completionRequestedBy: "pro",
    }),
  );
  assert.equal(asked.kind, "wrap-up");
  assert.equal(asked.title, "Ready to wrap up?");
  assert.equal(asked.action?.page, "project");
});

test("a professional is told when a customer chooses them, including for a project that is new to them", () => {
  const chosen = {
    ...project,
    status: "booked" as const,
    awardAccepted: false,
    customerName: "Maria",
  };
  const [moment] = workspaceMoments(
    view(pro, { projects: [] }),
    view(pro, { projects: [chosen] }),
  );
  assert.equal(moment.kind, "chosen");
  assert.match(moment.body, /Maria selected your estimate/);
  assert.deepEqual(moment.action, {
    label: "Open project",
    page: "project",
    id: "job",
  });
  // A customer's own newly posted project is announced by the form instead.
  assert.deepEqual(
    workspaceMoments(
      view(customer, { projects: [] }),
      view(customer, { projects: [{ ...project, status: "requested" }] }),
    ),
    [],
  );
});

test("estimates are announced to the sender and the recipient differently", () => {
  const sent = { quotes: [quote] };
  const [mine] = workspaceMoments(view(pro), view(pro, sent));
  assert.equal(mine.kind, "estimate-sent");
  assert.equal(mine.title, "Estimate sent");
  const [theirs] = workspaceMoments(view(customer), view(customer, sent));
  assert.equal(theirs.kind, "estimate-received");
  assert.deepEqual(theirs.action, {
    label: "View estimate",
    page: "project",
    id: "job",
  });
  const [revised] = workspaceMoments(
    view(pro, sent),
    view(pro, { quotes: [{ ...quote, revision: 2 }] }),
  );
  assert.equal(revised.title, "Estimate updated");
  assert.deepEqual(kinds(view(pro, sent), view(pro, sent)), []);
});

test("reviews thank the customer, notify the professional and announce the one response", () => {
  const written = { reviews: [review] };
  const [thanks] = workspaceMoments(view(customer), view(customer, written));
  assert.equal(thanks.kind, "review-thanks");
  assert.match(thanks.title, /Thank you/);
  const [received] = workspaceMoments(view(pro), view(pro, written));
  assert.equal(received.kind, "review-received");
  assert.match(received.body, /5 out of 5/);
  assert.equal(received.action?.page, "reviews");
  const answered = { reviews: [{ ...review, reply: "Thank you, Maria." }] };
  assert.deepEqual(kinds(view(pro, written), view(pro, answered)), [
    "reply-sent",
  ]);
  assert.deepEqual(kinds(view(customer, written), view(customer, answered)), [
    "reply-received",
  ]);
  assert.deepEqual(kinds(view(pro, answered), view(pro, answered)), []);
});

test("business milestones are celebrated once the server reports them", () => {
  const withProfile = (changes: Partial<Profile>) =>
    view(pro, { profiles: [{ ...profile, ...changes }] });
  assert.deepEqual(kinds(view(pro), withProfile({ verified: true })), [
    "verified",
  ]);
  assert.deepEqual(kinds(view(pro), withProfile({ reviewStatus: "pending" })), [
    "submitted",
  ]);
  const [approved] = workspaceMoments(
    withProfile({ reviewStatus: "pending" }),
    withProfile({ reviewStatus: "approved" }),
  );
  assert.equal(approved.kind, "approved");
  assert.match(approved.title, /Congratulations/);
  // Another business's profile changing is not this member's milestone.
  assert.deepEqual(
    kinds(
      view(customer),
      view(customer, { profiles: [{ ...profile, verified: true }] }),
    ),
    [],
  );
});

test("a burst of simultaneous changes is limited to three moments with distinct keys", () => {
  const moments = workspaceMoments(
    view(pro),
    view(pro, {
      projects: [{ ...project, status: "completed" }],
      quotes: [quote],
      reviews: [review],
      profiles: [{ ...profile, verified: true, reviewStatus: "approved" }],
    }),
  );
  assert.equal(moments.length, 3);
  assert.equal(new Set(moments.map((m) => m.key)).size, 3);
});
