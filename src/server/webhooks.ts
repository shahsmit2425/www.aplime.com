import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { stripe } from "./integrations/stripe.js";
import { env } from "./config.js";
import { transaction } from "./db/index.js";
import { notify } from "./repository.js";
import { requireValue, fail } from "./errors.js";
export const webhooks = Router();
webhooks.post(
  ["/stripe", "/stripe-connect"],
  raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    const secret =
      req.path === "/stripe-connect"
        ? env.STRIPE_CONNECT_WEBHOOK_SECRET
        : env.STRIPE_WEBHOOK_SECRET;
    requireValue(secret);
    let event;
    try {
      event = stripe().webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"] as string,
        secret,
      );
    } catch {
      fail(400, "Invalid webhook signature.");
    }
    await transaction(async (c) => {
      if (
        !(
          await c.query(
            "INSERT INTO webhook_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
            [event.id, event.type],
          )
        ).rowCount
      )
        return;
      const obj = event.data.object as unknown as Record<string, any>;
      if (
        event.type === "identity.verification_session.verified" ||
        event.type === "identity.verification_session.requires_input"
      ) {
        const verified = event.type.endsWith(".verified");
        // Match the stored session, not a caller-controlled profile field.
        const rows = (
          await c.query(
            "UPDATE profiles SET verified=$2 WHERE identity_session_id=$1 RETURNING id",
            [obj.id, verified],
          )
        ).rows;
        if (rows[0])
          await notify(
            c,
            rows[0].id,
            verified
              ? "Identity verified"
              : "Identity verification needs attention",
            "Open your business profile for the next step.",
          );
      }
      if (event.type.startsWith("customer.subscription.")) {
        // Serialize per customer and read Stripe's current state: out-of-order events
        // must not restore an expired subscription or overwrite a newer one.
        const owner = (
          await c.query(
            "SELECT * FROM professional_subscriptions WHERE customer_id=$1 FOR UPDATE",
            [
              typeof obj.customer === "string"
                ? obj.customer
                : obj.customer?.id,
            ],
          )
        ).rows[0];
        if (owner) {
          const current = await stripe().subscriptions.retrieve(obj.id);
          if (owner.subscription_id && owner.subscription_id !== current.id) {
            const old = await stripe().subscriptions.retrieve(
              owner.subscription_id,
            );
            if (
              !["canceled", "incomplete_expired"].includes(old.status) ||
              ["canceled", "incomplete_expired"].includes(current.status)
            )
              return;
          }
          const correctPrice = current.items.data.some(
            (item) => item.price.id === env.STRIPE_PRO_PRICE_ID,
          );
          await c.query(
            "UPDATE professional_subscriptions SET subscription_id=$2,status=$3,cancel_at_period_end=$4,updated_at=now() WHERE user_id=$1",
            [
              owner.user_id,
              current.id,
              correctPrice ? current.status : "unrecognized_price",
              current.cancel_at_period_end,
            ],
          );
        }
      }
      if (event.type === "account.updated")
        await c.query(
          "UPDATE profiles SET connect_ready=$2 WHERE stripe_account_id=$1",
          [obj.id, !!obj.charges_enabled && !!obj.payouts_enabled],
        );
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        if (obj.payment_status !== "paid") return;
        const payment = (
          await c.query(
            "SELECT * FROM payments WHERE checkout_id=$1 FOR UPDATE",
            [obj.id],
          )
        ).rows[0];
        if (!payment && obj.metadata?.projectId)
          fail(409, "Payment record is not visible yet; retry this event.");
        if (
          !payment ||
          payment.amount !== obj.amount_total ||
          obj.currency !== "usd"
        )
          return;
        if (payment.status !== "pending") return;
        await c.query(
          "UPDATE payments SET status='paid',intent_id=$2 WHERE id=$1",
          [
            payment.id,
            typeof obj.payment_intent === "string"
              ? obj.payment_intent
              : obj.payment_intent?.id,
          ],
        );
        const project = (
          await c.query("SELECT * FROM projects WHERE id=$1", [
            payment.project_id,
          ])
        ).rows[0];
        await notify(
          c,
          project.customer_id,
          "Payment received",
          "Your payment for " + project.title + " is confirmed.",
        );
        await notify(
          c,
          project.pro_id,
          "Payment received",
          "Payment for " + project.title + " is confirmed.",
        );
      }
      if (event.type === "charge.refunded" && obj.refunded) {
        const paid = (
          await c.query(
            "UPDATE payments SET status='refunded' WHERE intent_id=$1 RETURNING project_id",
            [obj.payment_intent],
          )
        ).rows[0];
        if (paid)
          await c.query(
            "UPDATE projects SET status='cancelled' WHERE id=$1 AND status='disputed'",
            [paid.project_id],
          );
      }
    });
    res.json({ received: true });
  },
);
