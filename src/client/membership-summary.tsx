import type { ReactNode } from "react";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { membershipStatus } from "../shared/membership-flow.js";

export function MembershipSummary({
  status,
  cancelAtPeriodEnd = false,
  checking,
  busy,
  onRefresh,
  children,
}: {
  status?: string;
  cancelAtPeriodEnd?: boolean;
  checking: boolean;
  busy: boolean;
  onRefresh: () => void;
  children?: ReactNode;
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
      <div>
        <p className="eyebrow">
          <span className="membership-summary-icon">
            {active ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <CreditCard size={18} aria-hidden="true" />
            )}
          </span>
          YOUR BUSINESS MEMBERSHIP
        </p>
        <h2>{presentation?.title || "Checking your membership…"}</h2>
        <p>
          {presentation?.description ||
            "Please wait while we load your account and available billing periods."}
        </p>
        <button
          className="secondary"
          disabled={checking || busy}
          onClick={onRefresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {checking ? "Checking…" : "Refresh status"}
        </button>
      </div>
      {children}
    </section>
  );
}
