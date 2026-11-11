import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { env, requiredKeys } from "../src/server/config.js";
import {
  membershipSpecs,
  membershipForPrice,
  subscriptionMembership,
} from "../src/server/membership-plans.js";
import { MembershipCards } from "../src/client/membership-cards.js";

const original = { ...env };
const configure = () =>
  Object.assign(env, {
    APP_ENV: "development",
    STRIPE_PRO_PRICE_ID: "price_old",
    STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly",
    STRIPE_PRO_SIX_MONTH_PRICE_ID: "price_six",
    STRIPE_PRO_YEARLY_PRICE_ID: "price_yearly",
  });
const price = (id = "price_monthly", amount = 4000, months = 1) =>
  ({
    id,
    active: true,
    type: "recurring",
    currency: "usd",
    livemode: false,
    unit_amount: amount,
    recurring: {
      interval: "month",
      interval_count: months,
      usage_type: "licensed",
    },
  }) as Stripe.Price;

test("three membership prices require complete distinct configuration while legacy stays supported", () => {
  try {
    configure();
    assert.equal(membershipSpecs().length, 3);
    const keys: readonly string[] = requiredKeys();
    for (const key of [
      "STRIPE_PRO_MONTHLY_PRICE_ID",
      "STRIPE_PRO_SIX_MONTH_PRICE_ID",
      "STRIPE_PRO_YEARLY_PRICE_ID",
    ])
      assert.ok(keys.includes(key));
    assert.ok(!keys.includes("STRIPE_PRO_PRICE_ID"));
    env.STRIPE_PRO_YEARLY_PRICE_ID = "";
    assert.throws(() => membershipSpecs(), /not configured correctly/);
    env.STRIPE_PRO_YEARLY_PRICE_ID = env.STRIPE_PRO_MONTHLY_PRICE_ID;
    assert.throws(() => membershipSpecs(), /not configured correctly/);
    Object.assign(env, {
      STRIPE_PRO_MONTHLY_PRICE_ID: "",
      STRIPE_PRO_SIX_MONTH_PRICE_ID: "",
      STRIPE_PRO_YEARLY_PRICE_ID: "",
    });
    assert.equal(membershipSpecs()[0].id, "legacy");
    assert.ok(
      (requiredKeys() as readonly string[]).includes("STRIPE_PRO_PRICE_ID"),
    );
    assert.equal(membershipForPrice(price("price_old", 2500))?.amount, 2500);
  } finally {
    Object.assign(env, original);
  }
});

test("membership recognizes only the correct USD amount, interval, mode, and single quantity", () => {
  try {
    configure();
    assert.equal(membershipForPrice(price())?.id, "monthly");
    assert.equal(
      membershipForPrice(price("price_six", 21000, 6))?.id,
      "six_month",
    );
    assert.equal(
      membershipForPrice({
        ...price("price_yearly", 36000),
        recurring: {
          interval: "year",
          interval_count: 1,
          usage_type: "licensed",
          trial_period_days: null,
          meter: null,
        },
      })?.id,
      "yearly",
    );
    for (const invalid of [
      price("price_unknown"),
      price("price_monthly", 1),
      price("price_six", 21000, 1),
      { ...price(), currency: "eur" },
      { ...price(), livemode: true },
      { ...price(), type: "one_time" },
      {
        ...price(),
        recurring: { ...price().recurring!, usage_type: "metered" },
      },
    ])
      assert.equal(membershipForPrice(invalid as Stripe.Price), null);
    assert.equal(membershipForPrice({ ...price(), active: false }, true), null);
    assert.ok(
      membershipForPrice({ ...price(), active: false }),
      "archived prices remain valid for existing subscriptions",
    );
    assert.equal(
      subscriptionMembership({
        items: { data: [{ price: price(), quantity: 2 }] },
      } as Stripe.Subscription),
      null,
    );
    assert.equal(
      subscriptionMembership({
        items: {
          data: [
            { price: price(), quantity: 1 },
            { price: price(), quantity: 1 },
          ],
        },
      } as Stripe.Subscription),
      null,
    );
  } finally {
    Object.assign(env, original);
  }
});

test("plan cards show the full upfront charge and renewal interval, with accessible selection", () => {
  try {
    configure();
    const plans = [
      price(),
      price("price_six", 21000, 6),
      price("price_yearly", 36000, 12),
    ].map((item) => membershipForPrice(item)!);
    const html = renderToStaticMarkup(
      createElement(MembershipCards, {
        plans,
        selected: "six_month",
        onSelect() {},
      }),
    );
    for (const text of [
      "$40.00",
      "$210.00",
      "$360.00",
      "$35.00/month equivalent",
      "$30.00/month equivalent",
      "Save 12.5% compared with monthly",
      "Save 25% compared with monthly",
      "Billed every 6 months",
      "Billed every year",
      "charged upfront",
      "Renews automatically until canceled",
    ])
      assert.ok(html.includes(text));
    assert.match(
      html,
      /type="radio"[^>]*checked=""[^>]*value="six_month"|type="radio"[^>]*value="six_month"[^>]*checked=""/,
    );
    assert.ok(
      !html.includes("price_"),
      "raw Stripe IDs are absent from the customer selection UI",
    );
  } finally {
    Object.assign(env, original);
  }
});
