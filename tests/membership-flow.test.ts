import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkoutReturnNotice,
  membershipStatus,
} from "../src/shared/membership-flow.js";
import { ProfessionalSetup } from "../src/client/professional-setup.js";
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

test("professional setup gives accessible links without inventing completed steps", () => {
  const html = renderToStaticMarkup(
    createElement(ProfessionalSetup, {
      current: "verification",
      go() {},
    }),
  );
  assert.match(html, /aria-label="Professional account setup"/);
  assert.match(html, /aria-current="step"/);
  for (const label of [
    "Business profile",
    "Verify identity",
    "Membership",
    "Marketplace review",
  ])
    assert.ok(html.includes(label));
  assert.ok(!html.includes("setup-link complete"));
  assert.ok(!html.includes("Identity confirmed"));
  assert.ok(!html.includes("Membership active"));
  const verified = renderToStaticMarkup(
    createElement(ProfessionalSetup, {
      current: "subscription",
      identityVerified: true,
      membershipActive: true,
      go() {},
    }),
  );
  assert.ok(verified.includes("Identity confirmed"));
  assert.ok(verified.includes("Membership active"));
  assert.ok(
    !verified.includes("Listing approved"),
    "membership never implies marketplace approval",
  );
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
