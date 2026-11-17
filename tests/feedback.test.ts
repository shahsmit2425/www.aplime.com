import test from "node:test";
import assert from "node:assert/strict";
import { feedbackSchema, feedbackPage } from "../src/shared/feedback.js";
import { FixedWindowBudget } from "../src/server/abuse-limits.js";
const valid = {
  id: "8e465b3c-0a6c-4be2-951e-69d71efc3422",
  category: "suggestion",
  message: "Please make navigation clearer.",
  email: "",
  page: "home",
};
test("anonymous feedback requires bounded content and rejects extra identity fields", () => {
  assert.equal(feedbackSchema.parse(valid).email, "");
  for (const input of [
    { ...valid, message: "short" },
    { ...valid, message: "a".repeat(2001) },
    { ...valid, email: "not-email" },
    { ...valid, userId: "forged" },
    { ...valid, page: "/app?token=private" },
  ])
    assert.equal(feedbackSchema.safeParse(input).success, false);
  assert.equal(
    feedbackSchema.parse({ ...valid, email: "reader@example.com" }).email,
    "reader@example.com",
  );
});
test("feedback context never includes project identifiers, query strings or private hashes", () => {
  assert.equal(feedbackPage("/app", "#/project/private-id"), "project");
  assert.equal(feedbackPage("/app", "#/messages/private-id"), "messages");
  assert.equal(feedbackPage("/professionals/private-id", ""), "professionals");
  assert.equal(feedbackPage("/secret/token", ""), "other");
});
test("feedback local network budget stops the sixth attempt and resets after an hour", () => {
  const budget = new FixedWindowBudget();
  for (let i = 0; i < 5; i++)
    assert.equal(budget.take("network", 5, 3600000, 0), true);
  assert.equal(budget.take("network", 5, 3600000, 1), false);
  assert.equal(budget.take("another-network", 5, 3600000, 1), true);
  assert.equal(budget.take("network", 5, 3600000, 3600000), true);
});
