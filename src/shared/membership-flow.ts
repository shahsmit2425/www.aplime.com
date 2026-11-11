export function membershipStatus(status: string, cancelAtPeriodEnd = false) {
  if (["active", "trialing"].includes(status))
    return {
      tone: "success",
      title: cancelAtPeriodEnd
        ? "Membership ending"
        : "Your membership is active",
      description: cancelAtPeriodEnd
        ? "Your membership continues through the current billing period and will not renew. Manage billing to review your cancellation."
        : "Your membership is ready. Marketplace approval and availability are managed separately in your business profile.",
    };
  if (["past_due", "unpaid", "incomplete", "paused"].includes(status))
    return {
      tone: "attention",
      title:
        status === "incomplete"
          ? "Finish your payment"
          : "Your membership needs attention",
      description:
        "Open Manage billing to review your subscription and payment method. Use your existing subscription rather than starting another one.",
    };
  if (["canceled", "incomplete_expired"].includes(status))
    return {
      tone: "neutral",
      title: "Choose a plan to rejoin",
      description:
        "Your previous membership has ended. Choose a billing period to start a new subscription when you are ready.",
    };
  if (status === "none")
    return {
      tone: "neutral",
      title: "Make room for your next opportunity",
      description:
        "One professional membership, three billing periods. Complete identity verification before opening checkout.",
    };
  return {
    tone: "attention",
    title: "We need to check your membership",
    description:
      "Your membership has not been confirmed. Refresh the status or contact support; do not start another payment to resolve this.",
  };
}

export function checkoutReturnNotice(hint: string | null, status: string) {
  if (hint === "canceled")
    return "You left checkout. No new membership is confirmed by this return. You can resume checkout or choose another billing period.";
  if (hint === "portal")
    return "Welcome back from billing. Your subscription status updates after Stripe confirms any changes.";
  if (hint === "processing")
    return ["active", "trialing"].includes(status)
      ? "Your membership has been confirmed. You can continue your business setup."
      : "Welcome back from checkout. We are checking for Stripe’s confirmation. This page refreshes automatically; returning here does not activate a membership.";
  return null;
}
