import { Router } from "express";
import { pool, transaction } from "./db/index.js";
import { stripe } from "./integrations/stripe.js";
import { env } from "./config.js";
import { fail, requireValue } from "./errors.js";
import { createHash } from "node:crypto";
import {
  membershipSpecs,
  membershipPlans,
  subscriptionMembership,
} from "./membership-plans.js";
import type { MembershipBilling } from "../shared/subscription.js";
export const subscriptions = Router();
subscriptions.use((req, _res, next) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  next();
});
subscriptions.get("/", async (req, res) => {
  const row = (
    await pool.query(
      "SELECT status,cancel_at_period_end,customer_id,subscription_id FROM professional_subscriptions WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0];
  let plans: MembershipBilling["plans"] = [];
  let pricingProblem: string | null = null;
  try {
    plans = await membershipPlans();
  } catch {
    console.warn("Membership catalog could not be loaded or validated.");
    pricingProblem =
      "Membership enrollment is temporarily unavailable. You can still manage existing billing.";
  }
  const profile = (
    await pool.query("SELECT verified,suspended FROM profiles WHERE id=$1", [
      req.account.id,
    ])
  ).rows[0];
  let currentPlan: MembershipBilling["currentPlan"] = null;
  let periodEnd: string | null = null;
  if (row?.subscription_id) {
    const current = await stripe().subscriptions.retrieve(row.subscription_id);
    const customer =
      typeof current.customer === "string"
        ? current.customer
        : current.customer.id;
    if (customer !== row.customer_id)
      fail(503, "Billing information is unavailable. Please contact support.");
    currentPlan = subscriptionMembership(current);
    const end = current.items.data[0]?.current_period_end;
    if (Number.isFinite(end) && end > 0)
      periodEnd = new Date(end * 1000).toISOString();
  }
  res.json({
    status: row?.status || "none",
    cancelAtPeriodEnd: row?.cancel_at_period_end || false,
    canManage: !!row?.customer_id,
    configured: plans.length > 0,
    canEnroll: !!profile?.verified && !profile.suspended,
    plans,
    pricingProblem,
    currentPlan,
    periodEnd,
  } satisfies MembershipBilling);
});
subscriptions.post("/checkout", async (req, res) => {
  const specs = membershipSpecs();
  requireValue(specs.length, "Subscriptions are not configured yet.");
  // Old clients default to the first plan. Never accept a client-supplied amount or Price ID.
  const selected = specs.find(
    (spec) => spec.id === (req.body?.plan ?? specs[0].id),
  );
  if (!selected) fail(400, "Choose a valid membership plan.");
  const plans = await membershipPlans();
  requireValue(
    plans.some((plan) => plan.id === selected.id),
    "This membership plan is unavailable.",
  );
  const result = await transaction(async (c) => {
    await c.query(
      "INSERT INTO professional_subscriptions(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [req.account.id],
    );
    const row = (
      await c.query(
        "SELECT * FROM professional_subscriptions WHERE user_id=$1 FOR UPDATE",
        [req.account.id],
      )
    ).rows[0];
    if (
      !(
        await c.query(
          "SELECT 1 FROM profiles WHERE id=$1 AND verified AND NOT suspended",
          [req.account.id],
        )
      ).rowCount
    )
      fail(
        409,
        "Complete your business profile and identity verification first.",
      );
    if (row.subscription_id) {
      const existing = await stripe().subscriptions.retrieve(
        row.subscription_id,
      );
      if (!["canceled", "incomplete_expired"].includes(existing.status))
        fail(409, "You already have a subscription. Use Manage billing.");
    }
    if (row.checkout_id) {
      const previous = await stripe().checkout.sessions.retrieve(
        row.checkout_id,
        { expand: ["line_items"] },
      );
      const previousCustomer =
        typeof previous.customer === "string"
          ? previous.customer
          : previous.customer?.id;
      if (previousCustomer !== row.customer_id)
        fail(
          503,
          "Billing information is unavailable. Please contact support.",
        );
      if (previous.status === "complete")
        fail(409, "Subscription is processing. Refresh shortly.");
      if (previous.status === "open") {
        const items = previous.line_items?.data;
        if (
          previous.url &&
          items?.length === 1 &&
          items[0].price?.id === selected.priceId &&
          items[0].quantity === 1
        )
          return { url: previous.url };
        // Prevent payment in an older tab after the professional chooses a different plan.
        try {
          await stripe().checkout.sessions.expire(previous.id);
        } catch {
          fail(
            409,
            "Your checkout changed. Refresh billing before trying again.",
          );
        }
      }
    }
    let customer = row.customer_id;
    if (!customer) {
      customer = (
        await stripe().customers.create(
          { email: req.account.email, name: req.account.name },
          { idempotencyKey: "pro-customer:" + req.account.id },
        )
      ).id;
      await c.query(
        "UPDATE professional_subscriptions SET customer_id=$2 WHERE user_id=$1",
        [req.account.id, customer],
      );
    }
    const parameters = {
      mode: "subscription",
      customer,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: env.SITE_URL + "/app/subscription?checkout=processing",
      cancel_url: env.SITE_URL + "/app/subscription?checkout=canceled",
      subscription_data: {
        metadata: { userId: req.account.id, plan: selected.id },
      },
    } as const;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(parameters))
      .digest("hex")
      .slice(0, 24);
    const session = await stripe().checkout.sessions.create(
      { ...parameters, line_items: [...parameters.line_items] },
      {
        idempotencyKey:
          "pro-checkout:" +
          req.account.id +
          ":" +
          (row.checkout_id || "initial") +
          ":v2:" +
          fingerprint,
      },
    );
    await c.query(
      "UPDATE professional_subscriptions SET checkout_id=$2 WHERE user_id=$1",
      [req.account.id, session.id],
    );
    return { url: session.url };
  });
  res.json(result);
});
subscriptions.post("/portal", async (req, res) => {
  const row = (
    await pool.query(
      "SELECT customer_id FROM professional_subscriptions WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0];
  if (!row?.customer_id) fail(409, "Start a subscription first.");
  const session = await stripe().billingPortal.sessions.create({
    customer: row.customer_id,
    return_url: env.SITE_URL + "/app/subscription?checkout=portal",
  });
  res.json({ url: session.url });
});
