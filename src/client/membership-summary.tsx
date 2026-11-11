import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { membershipStatus } from "../shared/membership-flow.js";

export function MembershipSummary({
  status,
  cancelAtPeriodEnd = false,
  checking,
  busy,
  onRefresh,
}: {
  status?: string;
  cancelAtPeriodEnd?: boolean;
  checking: boolean;
  busy: boolean;
  onRefresh: () => void;
}) {
  const presentation = status
    ? membershipStatus(status, cancelAtPeriodEnd)
    : null;
  const active = status === "active" || status === "trialing";
  return (
    <section
      className={`membership-summary ${presentation?.tone || "neutral"}`}
      aria-label="Membership status"
    >
      <div className="membership-summary-icon">
        {active ? (
          <CheckCircle2 size={30} aria-hidden="true" />
        ) : (
          <CreditCard size={30} aria-hidden="true" />
        )}
      </div>
      <div>
        <p className="eyebrow">YOUR BUSINESS MEMBERSHIP</p>
        <h2>{presentation?.title || "Checking your membership…"}</h2>
        <p>
          {presentation?.description ||
            "Please wait while we load your account and available billing periods."}
        </p>
      </div>
      <button
        className="secondary"
        disabled={checking || busy}
        onClick={onRefresh}
      >
        <RefreshCw size={16} aria-hidden="true" />
        {checking ? "Checking…" : "Refresh status"}
      </button>
    </section>
  );
}
