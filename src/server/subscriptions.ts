import { Router } from "express";
import { pool, transaction } from "./db/index.js";
import { stripe } from "./integrations/stripe.js";
import { env } from "./config.js";
import { fail, requireValue } from "./errors.js";
export const subscriptions = Router();
subscriptions.use((req, _res, next) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  next();
});
subscriptions.get("/", async (req, res) => {
  const row = (
    await pool.query(
      "SELECT status,cancel_at_period_end,customer_id FROM professional_subscriptions WHERE user_id=$1",
      [req.account.id],
    )
  ).rows[0];
  res.json({
    status: row?.status || "none",
    cancelAtPeriodEnd: row?.cancel_at_period_end || false,
    canManage: !!row?.customer_id,
    configured: !!env.STRIPE_PRO_PRICE_ID,
  });
});
subscriptions.post("/checkout", async (req, res) => {
  requireValue(
    env.STRIPE_PRO_PRICE_ID,
    "Subscriptions are not configured yet.",
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
      );
      if (previous.status === "open" && previous.url)
        return { url: previous.url };
      if (previous.status === "complete" && !row.subscription_id)
        fail(409, "Subscription is processing. Refresh shortly.");
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
    const session = await stripe().checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
        success_url: env.SITE_URL + "/app/subscription?checkout=processing",
        cancel_url: env.SITE_URL + "/app/subscription",
        subscription_data: { metadata: { userId: req.account.id } },
      },
      {
        idempotencyKey:
          "pro-checkout:" +
          req.account.id +
          ":" +
          (row.checkout_id || "initial"),
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
    return_url: env.SITE_URL + "/app/subscription",
  });
  res.json({ url: session.url });
});
