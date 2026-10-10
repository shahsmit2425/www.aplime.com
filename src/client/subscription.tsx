import { useEffect, useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  ArrowRight,
  CalendarDays,
  LockKeyhole,
  CircleAlert,
} from "lucide-react";
import type {
  MembershipBilling,
  MembershipPlanId,
} from "../shared/subscription.js";
import { money } from "../shared/domain.js";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Empty, Head, Panel } from "./ui.js";
import { MembershipCards, billingPeriod } from "./membership-cards.js";
import { checkoutReturnNotice } from "../shared/membership-flow.js";
import { MembershipSummary } from "./membership-summary.js";

export function Subscription() {
  const { data, busy, run, go } = useWorkspace();
  const [billing, setBilling] = useState<MembershipBilling | null>(null);
  const [selected, setSelected] = useState<MembershipPlanId | null>(null);
  const [problem, setProblem] = useState("");
  const [checking, setChecking] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    if (data.user.role !== "pro") return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      if (active) setChecking(true);
      try {
        const result: MembershipBilling = await request("/subscription");
        if (active) {
          setBilling(result);
          setSelected((previous) => {
            if (
              !["none", "canceled", "incomplete_expired"].includes(
                result.status,
              )
            )
              return result.plans.some(
                (plan) => plan.id === result.currentPlan?.id,
              )
                ? result.currentPlan!.id
                : null;
            return result.plans.some((plan) => plan.id === previous)
              ? previous
              : result.plans[0]?.id || null;
          });
          setProblem("");
        }
      } catch (error) {
        if (active) setProblem((error as Error).message);
      } finally {
        pending = false;
        if (active) setChecking(false);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("aplime:updates", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("aplime:updates", refresh);
    };
  }, [data.user.id, data.user.role, refreshVersion]);
  if (data.user.role !== "pro")
    return (
      <Empty title="No customer payments on Aplime">
        Arrange service payment directly with your professional. Only businesses
        pay Aplime for a subscription.
      </Empty>
    );
  const plan = billing?.plans.find((item) => item.id === selected);
  const profile = data.profiles.find((item) => item.id === data.user.id);
  const active = !!billing && ["active", "trialing"].includes(billing.status);
  const returnNotice = billing
    ? checkoutReturnNotice(
        new URLSearchParams(location.search).get("checkout"),
        billing.status,
      )
    : null;
  const canStart =
    !!billing?.canEnroll &&
    ["none", "canceled", "incomplete_expired"].includes(billing.status);
  const choosingPlan =
    !!billing &&
    ["none", "canceled", "incomplete_expired"].includes(billing.status);
  return (
    <>
      <Head title="Your Aplime business subscription">
        Choose your billing period for the same professional membership. Service
        payments are arranged directly with customers.
      </Head>
      {returnNotice && (
        <p className="membership-return" role="status">
          <CircleAlert size={20} aria-hidden="true" />
          {returnNotice}
        </p>
      )}
      <MembershipSummary
        status={billing?.status}
        cancelAtPeriodEnd={billing?.cancelAtPeriodEnd}
        checking={checking}
        busy={busy}
        onRefresh={() => setRefreshVersion((value) => value + 1)}
      />
      <div className="membership-layout">
        <div>
          <Panel
            title={choosingPlan ? "Choose your membership" : "Your billing"}
          >
            {problem && (
              <p className="alert error" role="alert">
                {problem}
              </p>
            )}
            {billing?.pricingProblem && (
              <p className="alert error" role="alert">
                {billing.pricingProblem}
              </p>
            )}
            {billing?.currentPlan && (
              <p className="membership-current-plan">
                <strong>{billing.currentPlan.label}</strong> ·{" "}
                {money(billing.currentPlan.amount)} every{" "}
                {billingPeriod(billing.currentPlan.months)}
              </p>
            )}
            {billing?.periodEnd && (
              <p>
                <CalendarDays size={16} aria-hidden="true" />{" "}
                {billing.cancelAtPeriodEnd
                  ? "Membership ends"
                  : ["active", "trialing"].includes(billing.status)
                    ? "Current billing period ends"
                    : "Last billing period ended"}{" "}
                {new Date(billing.periodEnd).toLocaleDateString(undefined, {
                  dateStyle: "long",
                })}
                .
              </p>
            )}
            {billing?.cancelAtPeriodEnd && (
              <p>
                Cancellation is scheduled for the end of the current billing
                period. Your membership will not renew.
              </p>
            )}
            {billing && !billing.canEnroll && (
              <div className="membership-prerequisite">
                <ShieldCheck size={24} aria-hidden="true" />
                <div>
                  <strong>
                    {profile?.suspended
                      ? "Your account needs review"
                      : !profile
                        ? "First, introduce your business"
                        : "Verify your identity to continue"}
                  </strong>
                  <p>
                    {profile?.suspended
                      ? "Contact support about your account status. You can still manage existing billing below."
                      : !profile
                        ? "Save your business details, then complete the secure ID check. You can review the plans now."
                        : "Complete the account holder’s photo ID and selfie check before subscribing."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      go(
                        profile?.suspended
                          ? "help"
                          : !profile
                            ? "profile"
                            : "verification",
                      )
                    }
                  >
                    {profile?.suspended
                      ? "Contact support"
                      : !profile
                        ? "Create business profile"
                        : "Verify my identity"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
            {billing && !billing.configured && (
              <p>Subscription enrollment is not configured yet.</p>
            )}
            {!!billing?.plans.length && choosingPlan && (
              <MembershipCards
                plans={billing.plans}
                selected={selected}
                onSelect={setSelected}
                disabled={busy || !canStart || !!problem}
              />
            )}
            {choosingPlan && (
              <p>
                Stripe shows the final recurring charge before you confirm.
                After checkout, activation may take a moment; this page updates
                automatically.
              </p>
            )}
            <div className="actions">
              {canStart && (
                <button
                  disabled={busy || !plan || !!problem}
                  onClick={() =>
                    void run(async () => {
                      const result = await request("/subscription/checkout", {
                        plan: selected,
                      });
                      await openExternal(result.url);
                    }, "")
                  }
                >
                  {busy
                    ? "Opening checkout…"
                    : plan
                      ? `Continue with ${plan.label.toLowerCase()} · ${money(plan.amount)}`
                      : "Choose a plan"}
                </button>
              )}
              {billing?.canManage && (
                <button
                  className="secondary"
                  disabled={busy || !billing?.canManage}
                  onClick={() =>
                    void run(async () => {
                      const result = await request("/subscription/portal", {});
                      await openExternal(result.url);
                    }, "")
                  }
                >
                  <CreditCard size={16} /> Manage billing and cancellation
                </button>
              )}
              {active && (
                <button
                  className="secondary"
                  onClick={() => go("profile", "setup")}
                >
                  Continue business setup <ArrowRight size={16} />
                </button>
              )}
            </div>
          </Panel>
        </div>
        <aside className="membership-guide">
          <h2>Everything stays in one place</h2>
          <div>
            <LockKeyhole size={23} />
            <span>
              <strong>Secure checkout with Stripe</strong>
              <p>
                Review the recurring total and enter your payment details on
                Stripe’s checkout page.
              </p>
            </span>
          </div>
          <div>
            <CalendarDays size={23} />
            <span>
              <strong>Your billing, your control</strong>
              <p>
                Use Manage billing to view invoices, update your payment method,
                and cancel renewal.
              </p>
            </span>
          </div>
          <div>
            <ShieldCheck size={23} />
            <span>
              <strong>A separate marketplace review</strong>
              <p>
                Identity verification and membership do not approve your
                listing. Submit your completed business profile for review.
              </p>
            </span>
          </div>
          <p className="membership-guide-note">
            Customers pay their professional directly for services. This
            subscription is your business’s payment to Aplime.
          </p>
          <button className="text-button" onClick={() => go("help")}>
            Need help with billing? <ArrowRight size={16} />
          </button>
        </aside>
      </div>
    </>
  );
}
