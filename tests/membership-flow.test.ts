import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkoutReturnNotice,
  membershipStatus,
} from "../src/shared/membership-flow.js";
import { setupSteps } from "../src/shared/business-setup.js";
import type { Profile } from "../src/shared/domain.js";
import { MembershipSummary } from "../src/client/membership-summary.js";

test("checkout return never claims activation before webhook-backed membership is active", () => {
  for (const status of [
    "none",
    "incomplete",
    "past_due",
    "unrecognized_price",
    "canceled",
  ]) {
    assert.match(
      checkoutReturnNotice("processing", status)!,
      /does not activate/,
    );
    assert.doesNotMatch(
      checkoutReturnNotice("processing", status)!,
      /membership has been confirmed/,
    );
    assert.notEqual(membershipStatus(status).tone, "success");
  }
  for (const status of ["active", "trialing"]) {
    assert.match(
      checkoutReturnNotice("processing", status)!,
      /membership has been confirmed/,
    );
    assert.equal(membershipStatus(status).tone, "success");
  }
  assert.match(checkoutReturnNotice("canceled", "none")!, /resume checkout/);
  assert.match(
    checkoutReturnNotice("portal", "active")!,
    /after Stripe confirms/,
  );
  assert.equal(checkoutReturnNotice("unknown", "active"), null);
  assert.equal(checkoutReturnNotice(null, "none"), null);
});

test("membership problems direct existing subscribers to billing rather than a second subscription", () => {
  for (const status of ["past_due", "unpaid", "incomplete", "paused"]) {
    assert.match(
      membershipStatus(status).description,
      /existing subscription rather than starting another/,
    );
  }
  assert.match(membershipStatus("active", true).description, /will not renew/);
  assert.match(
    membershipStatus("unrecognized_price").description,
    /do not start another payment/,
  );
  assert.match(
    membershipStatus("active").description,
    /approval and availability are managed separately/,
  );
});

test("business setup never invents completed steps and finishes only when the listing is live", () => {
  const complete = (profile?: Partial<Profile>, membership = false) =>
    setupSteps(profile as Profile | undefined, membership).map(
      (step) => step.complete,
    );
  assert.deepEqual(
    setupSteps(undefined, false).map((step) => step.label),
    [
      "Business profile",
      "Identity verification",
      "Membership",
      "Marketplace review",
    ],
  );
  assert.deepEqual(complete(), [false, false, false, false]);
  assert.deepEqual(
    complete({ verified: true, reviewStatus: "pending" }, true),
    [true, true, true, false],
    "membership never implies marketplace approval",
  );
  assert.deepEqual(
    complete({ verified: true, reviewStatus: "approved", listed: true }, true),
    [true, true, true, true],
  );
  assert.deepEqual(
    complete({ verified: true, reviewStatus: "pending", listed: true }, false),
    [true, true, false, true],
    "a lapsed membership reopens setup while re-reviewed edits keep the listing",
  );
  const suspended = setupSteps(
    { verified: true, listed: true, suspended: true } as Profile,
    true,
  )[3]!;
  assert.equal(suspended.complete, false);
  assert.equal(suspended.detail, "Contact support");
});

test("membership summary distinguishes loading, confirmed cancellation and billing problems", () => {
  const render = (status?: string, cancelAtPeriodEnd = false) =>
    renderToStaticMarkup(
      createElement(MembershipSummary, {
        status,
        cancelAtPeriodEnd,
        checking: false,
        busy: false,
        onRefresh() {},
      }),
    );
  assert.match(render(), /Checking your membership/);
  assert.doesNotMatch(render(), /membership is active/);
  assert.match(render("active"), /Your membership is active/);
  assert.match(render("active", true), /Membership ending/);
  assert.match(render("active", true), /will not renew/);
  assert.match(render("past_due"), /membership needs attention/);
  assert.doesNotMatch(render("past_due"), /membership is active/);
});
