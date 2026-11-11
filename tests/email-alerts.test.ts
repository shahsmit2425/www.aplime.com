import test from "node:test";
import assert from "node:assert/strict";
import { emailAllowed, emailPolicy } from "../src/shared/email-alerts.js";
import { eventEmail } from "../src/server/email-template.js";

test("email categories honor optional preferences while essential notices remain enabled", () => {
  assert.equal(emailAllowed({ emailAlerts: false }, "projects", false), false);
  assert.equal(
    emailAllowed({ emailCategories: { messages: false } }, "messages", false),
    false,
  );
  for (const title of [
    "Membership payment failed",
    "All devices signed out",
    "Aplime support contacted you",
    "Business profile suspended",
  ])
    assert.equal(emailPolicy(title).essential, true);
  assert.equal(emailAllowed({ emailAlerts: false }, "security", true), true);
  assert.equal(emailPolicy("New message", { page: "messages" }).grouped, true);
  for (const title of [
    "Preferences updated",
    "Project archived",
    "Call meeting completed",
  ])
    assert.equal(emailPolicy(title).muted, true);
  assert.equal(
    emailPolicy("How was your professional?", { page: "project" }).category,
    "reviews",
  );
});
test("email HTML escapes user content and only links to authenticated account routes", () => {
  const email = eventEmail(
    '<img src=x onerror="alert(1)">',
    "<script>secret</script> & text",
    { page: "project", id: "abc/../../evil" },
  );
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(email.html.includes("abc%2F..%2F..%2Fevil"));
  assert.ok(email.text.includes("/app/project/"));
  assert.ok(
    !eventEmail("Update", "Body", {
      page: "https://evil.invalid",
    }).html.includes("evil.invalid"),
  );
  const admin = eventEmail(
    "Review needed",
    "Sign in",
    { page: "reports" },
    "admin",
  );
  assert.ok(!admin.html.includes("/app/"));
  assert.ok(admin.text.includes("Administration"));
});
