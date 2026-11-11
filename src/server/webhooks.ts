import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { stripe } from "./integrations/stripe.js";
import { env } from "./config.js";
import { transaction } from "./db/index.js";
import { notify } from "./repository.js";
import { requireValue, fail } from "./errors.js";
import { subscriptionMembership } from "./membership-plans.js";
import { notifyOnce } from "./email-alerts.js";
export const webhooks = Router();
const subscriptionEvents = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
]);
const identityEvents = new Set([
  "identity.verification_session.verified",
  "identity.verification_session.requires_input",
  "identity.verification_session.processing",
  "identity.verification_session.canceled",
]);
webhooks.post(
  ["/stripe", "/stripe-connect", "/stripe-subscriptions", "/stripe-identity"],
  raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    // Each dedicated destination must authenticate with its own signing secret.
    const secret =
      req.path === "/stripe-subscriptions"
        ? env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
        : req.path === "/stripe-identity"
          ? env.STRIPE_IDENTITY_WEBHOOK_SECRET
          : req.path === "/stripe-connect"
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
    if (
      (req.path === "/stripe-subscriptions" &&
        !subscriptionEvents.has(event.type)) ||
      (req.path === "/stripe-identity" && !identityEvents.has(event.type))
    )
      fail(400, "Event type is not supported by this webhook destination.");
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
        subscriptionEvents.has(event.type) &&
        event.type.startsWith("invoice.")
      ) {
        const customerId =
          typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
        const subscription =
          obj.parent?.subscription_details?.subscription || obj.subscription;
        const subscriptionId =
          typeof subscription === "string" ? subscription : subscription?.id;
        if (!customerId || !subscriptionId) return;
        const owner = (
          await c.query(
            "SELECT * FROM professional_subscriptions WHERE customer_id=$1 FOR UPDATE",
            [customerId],
          )
        ).rows[0];
        if (
          !owner ||
          (owner.subscription_id && owner.subscription_id !== subscriptionId)
        )
          return;
        const current = await stripe().subscriptions.retrieve(subscriptionId);
        const currentCustomer =
          typeof current.customer === "string"
            ? current.customer
            : current.customer.id;
        if (currentCustomer !== customerId || !subscriptionMembership(current))
          return;
        if (
          event.type === "invoice.upcoming" &&
          (current.cancel_at_period_end ||
            !["active", "trialing"].includes(current.status))
        )
          return;
        // An old failed invoice must not generate a payment demand after it was paid.
        const invoice =
          event.type === "invoice.upcoming"
            ? obj
            : await stripe().invoices.retrieve(obj.id);
        if (event.type === "invoice.paid" && invoice.status !== "paid") return;
        if (
          [
            "invoice.payment_failed",
            "invoice.payment_action_required",
          ].includes(event.type) &&
          invoice.status !== "open"
        )
          return;
        const titles: Record<string, string> = {
          "invoice.paid": "Membership payment received",
          "invoice.payment_failed": "Membership payment failed",
          "invoice.payment_action_required":
            "Membership payment needs confirmation",
          "invoice.upcoming": "Your membership renews soon",
        };
        await notifyOnce(
          c,
          owner.user_id,
          `billing:${event.type}:${obj.id || subscriptionId + ":" + obj.period_end}`,
          titles[event.type],
          event.type === "invoice.paid"
            ? "Your Aplime membership invoice is paid. Open Membership for billing details. This is not a payment for home services."
            : event.type === "invoice.upcoming"
              ? "Your Aplime membership is approaching renewal. Review your plan and billing details in Membership."
              : "Your Aplime membership payment needs attention. Open Membership to manage billing securely.",
          { page: "subscription" },
        );
      }
      if (identityEvents.has(event.type)) {
        const owner = (
          await c.query(
            "SELECT id,verified FROM profiles WHERE identity_session_id=$1 FOR UPDATE",
            [obj.id],
          )
        ).rows[0];
        if (owner) {
          // Read current Stripe state so a delayed retry event cannot undo verification.
          // Only the stored session may update this account; metadata is never authority.
          const current = await stripe().identity.verificationSessions.retrieve(
            obj.id,
          );
          const verified = current.status === "verified";
          await c.query(
            "UPDATE profiles SET verified=$2 WHERE identity_session_id=$1",
            [obj.id, verified],
          );
          if (
            verified !== owner.verified ||
            current.status === "requires_input" ||
            current.status === "canceled"
          )
            await notify(
              c,
              owner.id,
              verified
                ? "Identity verified"
                : current.status === "canceled"
                  ? "Identity verification canceled"
                  : "Identity verification needs attention",
              "Open identity verification for the result and next step.",
              { page: "verification" },
            );
        }
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
          const plan = subscriptionMembership(current);
          const priceId = current.items.data[0]?.price.id || null;
          const correctPrice = !!plan;
          const newStatus = correctPrice
            ? current.status
            : "unrecognized_price";
          if (
            owner.status !== newStatus ||
            owner.cancel_at_period_end !== current.cancel_at_period_end ||
            (owner.billing_price_id && owner.billing_price_id !== priceId)
          )
            await notify(
              c,
              owner.user_id,
              owner.status !== newStatus
                ? newStatus === "active" || newStatus === "trialing"
                  ? "Membership activated"
                  : newStatus === "canceled"
                    ? "Membership ended"
                    : "Membership needs attention"
                : owner.cancel_at_period_end !== current.cancel_at_period_end
                  ? current.cancel_at_period_end
                    ? "Membership cancellation scheduled"
                    : "Membership renewal restored"
                  : "Membership plan updated",
              "Your membership status is " +
                newStatus.replaceAll("_", " ") +
                (current.cancel_at_period_end
                  ? ". Cancellation is scheduled at the end of the billing period."
                  : ". Open your subscription for details."),
              { page: "subscription" },
            );
          await c.query(
            "UPDATE professional_subscriptions SET subscription_id=$2,status=$3,cancel_at_period_end=$4,updated_at=now(),billing_price_id=$5 WHERE user_id=$1",
            [
              owner.user_id,
              current.id,
              correctPrice ? current.status : "unrecognized_price",
              current.cancel_at_period_end,
              priceId,
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
        if (paid) {
          const closed = (
            await c.query(
              "UPDATE projects SET status='cancelled',version=version+1 WHERE id=$1 AND status='disputed' RETURNING customer_id,pro_id,title",
              [paid.project_id],
            )
          ).rows[0];
          if (closed)
            for (const userId of [closed.customer_id, closed.pro_id])
              await notify(
                c,
                userId,
                "Refund processed",
                closed.title +
                  ": the payment was refunded and the project is closed.",
                { page: "project", id: paid.project_id },
              );
        }
      }
    });
    res.json({ received: true });
  },
);
