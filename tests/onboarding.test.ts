import test from "node:test";
import assert from "node:assert/strict";
import {
  accountLandingPage,
  pageAfterAuthentication,
} from "../src/client/onboarding.js";

test("new customers and returning users enter the expected workspace", () => {
  assert.equal(accountLandingPage("customer", false), "dashboard");
  assert.equal(pageAfterAuthentication("login", "customer", false), "dashboard");
  assert.equal(pageAfterAuthentication("projects", "customer", false), "projects");
});

test("professionals complete onboarding before entering their dashboard", () => {
  assert.equal(accountLandingPage("pro", false), "onboarding");
  assert.equal(pageAfterAuthentication("register", "pro", false), "onboarding");
  assert.equal(pageAfterAuthentication("login", "pro", true), "dashboard");
  assert.equal(pageAfterAuthentication("messages", "pro", false), "messages");
});
