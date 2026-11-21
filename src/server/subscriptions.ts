import { Router } from "express";
import { pool, transaction } from "./db/index.js";
import { stripe } from "./integrations/stripe.js";
import { env } from "./config.js";
import { fail, requireValue } from "./errors.js";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import {
  membershipSpecs,
  membershipPlans,
  subscriptionMembership,
  schedulePhases,
  scheduledPlan,
  changePhases,
} from "./membership-plans.js";
import { notify } from "./repository.js";
import { money } from "../shared/domain.js";
import type { PoolClient } from "pg";
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
  let pendingChange: MembershipBilling["pendingChange"] = null;
  let canChange = false;
  if (row?.subscription_id) {
    const current = await stripe().subscriptions.retrieve(row.subscription_id, {
      expand: ["schedule"],
    });
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
    if (
      plans.length &&
      current.schedule &&
      typeof current.schedule === "object"
    )
      pendingChange = scheduledPlan(current.schedule, plans);
    canChange =
      row.status === "active" &&
      changeProblem(current) === null &&
      plans.some((plan) => plan.id !== currentPlan?.id);
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
    canChange,
    pendingChange,
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
    const account = (
      await c.query(
        "SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
        [req.account.id],
      )
    ).rows[0];
    if (!account) fail(403, "This account is no longer available.");
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
// Why this subscription cannot move to another billing period, if it cannot.
function changeProblem(current: Stripe.Subscription) {
  if (current.status !== "active")
    return "Your membership must be active to change billing period. Use Manage billing.";
  if (current.cancel_at_period_end || current.cancel_at)
    return "Your membership is set to end. Restore renewal in Manage billing before changing billing period.";
  if (!subscriptionMembership(current))
    return "This membership cannot be changed here. Please contact support.";
  return null;
}
// Lock the member's billing row and read the subscription Stripe holds now.
async function lockedSubscription(c: PoolClient, userId: string) {
  const row = (
    await c.query(
      "SELECT customer_id,subscription_id FROM professional_subscriptions WHERE user_id=$1 FOR UPDATE",
      [userId],
    )
  ).rows[0];
  if (!row?.subscription_id) fail(409, "Start a subscription first.");
  const current = await stripe().subscriptions.retrieve(row.subscription_id, {
    expand: ["schedule"],
  });
  const customer =
    typeof current.customer === "string"
      ? current.customer
      : current.customer.id;
  if (customer !== row.customer_id)
    fail(503, "Billing information is unavailable. Please contact support.");
  const schedule =
    current.schedule &&
    typeof current.schedule === "object" &&
    current.schedule.status === "active"
      ? current.schedule
      : null;
  return { current, schedule };
}
const longDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
// A new billing period starts when the paid one ends: nothing is charged,
// credited or prorated today, and the renewal date does not move.
subscriptions.post("/change", async (req, res) => {
  const selected = membershipSpecs().find((spec) => spec.id === req.body?.plan);
  if (!selected) fail(400, "Choose a valid membership plan.");
  const plan = (await membershipPlans()).find(
    (item) => item.id === selected.id,
  );
  if (!plan) fail(409, "This membership plan is unavailable.");
  const result = await transaction(async (c) => {
    const { current, schedule } = await lockedSubscription(c, req.account.id);
    const problem = changeProblem(current);
    if (problem) fail(409, problem);
    if (current.items.data[0].price.id === selected.priceId)
      fail(
        409,
        schedule && schedulePhases(schedule)?.next
          ? "This is your current billing period. Choose Keep current billing to cancel the scheduled change."
          : "You are already on this billing period.",
      );
    const active =
      schedule ||
      (await stripe().subscriptionSchedules.create({
        from_subscription: current.id,
      }));
    const phases = schedulePhases(active);
    if (!phases)
      fail(503, "Billing information is unavailable. Please contact support.");
    await stripe().subscriptionSchedules.update(active.id, {
      end_behavior: "release",
      phases: changePhases(phases.current, selected.priceId),
    });
    await notify(
      c,
      req.account.id,
      "Billing period change scheduled",
      `${plan.label} billing (${money(plan.amount)}) starts ${longDate(phases.current.end_date)}. Your current billing period is unchanged until then.`,
      { page: "subscription" },
    );
    return {
      plan,
      effectiveAt: new Date(phases.current.end_date * 1000).toISOString(),
    };
  });
  res.json(result);
});
subscriptions.post("/change/cancel", async (req, res) => {
  await transaction(async (c) => {
    const { schedule } = await lockedSubscription(c, req.account.id);
    if (!schedule || !schedulePhases(schedule)?.next)
      fail(409, "No billing period change is scheduled.");
    // Releasing leaves the subscription renewing on its current price.
    await stripe().subscriptionSchedules.release(schedule.id);
    await notify(
      c,
      req.account.id,
      "Billing period change canceled",
      "Your membership keeps its current billing period and renews as before.",
      { page: "subscription" },
    );
  });
  res.json({ ok: true });
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
