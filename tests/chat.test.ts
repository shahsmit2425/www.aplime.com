import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedDiscussion,
  discussionRoute,
  discussionContext,
  supportConversationId,
  type Discussion,
} from "../src/shared/chat.js";
const first = {
  id: "discussion-a",
  project_id: "project-a",
  pro_id: "pro-a",
  selected_pro: "pro-b",
} as Discussion;
const chosen = { ...first, id: "discussion-b", pro_id: "pro-b" } as Discussion;
test("inbox routes keep support separate and choose the selected professional for legacy project links", () => {
  assert.equal(selectedDiscussion([first, chosen], "project-a"), chosen);
  assert.equal(selectedDiscussion([first, chosen], "discussion-a"), first);
  assert.equal(selectedDiscussion([first], "missing"), undefined);
  assert.equal(selectedDiscussion([first], "support:discussion-a"), undefined);
  assert.equal(selectedDiscussion([first], "new-support"), undefined);
  assert.equal(selectedDiscussion([first]), undefined);
});
test("only valid namespaced support IDs can be used for support API requests", () => {
  const id = "e82bba00-6e14-44f8-b71e-2cf2cd675390";
  assert.equal(supportConversationId("support:" + id), id);
  for (const value of [
    undefined,
    id,
    "support:../../admin",
    "support:",
    "new-support",
  ])
    assert.equal(supportConversationId(value), undefined);
});

test("pair conversations resolve all previous conversation and project links", () => {
  const pair = {
    ...first,
    aliases: ["discussion-a", "discussion-c"],
    projects: [
      {
        id: "project-a",
        title: "First",
        status: "completed",
        selected_pro: null,
      },
      {
        id: "project-c",
        title: "Next",
        status: "requested",
        selected_pro: null,
      },
    ],
  } as Discussion;
  assert.equal(selectedDiscussion([pair], "discussion-c"), pair);
  assert.equal(selectedDiscussion([pair], "project-c"), pair);
  assert.equal(selectedDiscussion([pair], "project-a"), pair);
  assert.equal(selectedDiscussion([pair], "unrelated"), undefined);
});

test("project links prefer its selected pro even when it is an older context", () => {
  const other = {
    ...first,
    id: "other-pair",
    project_id: "new-project",
    projects: [
      {
        id: "old-project",
        title: "Old",
        status: "booked",
        selected_pro: "pro-b",
      },
    ],
  } as Discussion;
  const selected = {
    ...other,
    id: "selected-pair",
    pro_id: "pro-b",
  } as Discussion;
  assert.equal(selectedDiscussion([other, selected], "old-project"), selected);
});

test("explicit project links and notification links keep the correct project context in a shared chat", () => {
  const pair = {
    ...first,
    aliases: ["discussion-a", "discussion-c"],
    messages: [{ project_id: "project-c" }],
    projects: [
      {
        id: "project-a",
        discussion_id: "discussion-a",
        title: "First",
        status: "completed",
        selected_pro: null,
      },
      {
        id: "project-c",
        discussion_id: "discussion-c",
        title: "Next",
        status: "requested",
        selected_pro: null,
      },
    ],
  } as Discussion;
  const route = discussionRoute(pair.id, "project-a");
  assert.equal(selectedDiscussion([pair], route), pair);
  assert.equal(discussionContext(pair, route)?.id, "project-a");
  assert.equal(discussionContext(pair, pair.id)?.id, "project-c");
  assert.equal(discussionContext(pair, "discussion-c")?.id, "project-c");
  assert.equal(
    selectedDiscussion([pair], discussionRoute(pair.id, "unrelated")),
    undefined,
  );
});
