export function membershipStatus(status: string, cancelAtPeriodEnd = false) {
  if (["active", "trialing"].includes(status))
    return {
      tone: "success",
      title: cancelAtPeriodEnd
        ? "Membership ending"
        : "Your membership is active",
      description: cancelAtPeriodEnd
        ? "Your membership continues through the current billing period and will not renew."
        : "Marketplace approval and availability are managed separately in your business profile.",
    };
  if (["past_due", "unpaid", "incomplete", "paused"].includes(status))
    return {
      tone: "attention",
      title:
        status === "incomplete"
          ? "Finish your payment"
          : "Your membership needs attention",
      description:
        "Open Manage billing to review your payment method. Use your existing subscription rather than starting another.",
    };
  if (["canceled", "incomplete_expired"].includes(status))
    return {
      tone: "neutral",
      title: "Choose a plan to rejoin",
      description:
        "Your previous membership has ended. Choose a billing period to start a new one.",
    };
  if (status === "none")
    return {
      tone: "neutral",
      title: "Make room for your next opportunity",
      description: "Complete identity verification before opening checkout.",
    };
  return {
    tone: "attention",
    title: "We need to check your membership",
    description:
      "Your membership is not confirmed. Refresh the status or contact support; do not start another payment.",
  };
}

export function checkoutReturnNotice(hint: string | null, status: string) {
  if (hint === "canceled")
    return "You left checkout, so no new membership is confirmed. You can resume checkout.";
  if (hint === "portal")
    return "Your subscription status updates after Stripe confirms any changes.";
  if (hint === "processing")
    return ["active", "trialing"].includes(status)
      ? "Your membership has been confirmed. You can continue your business setup."
      : "We are checking for Stripe’s confirmation. Returning here does not activate a membership.";
  return null;
}
