import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedDiscussion,
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
