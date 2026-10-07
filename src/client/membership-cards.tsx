import type {
  MembershipPlan,
  MembershipPlanId,
} from "../shared/subscription.js";
import { money } from "../shared/domain.js";

export function billingPeriod(months: number) {
  return months === 1 ? "month" : months === 12 ? "year" : `${months} months`;
}
export function MembershipCards({
  plans,
  selected,
  onSelect,
  disabled = false,
}: {
  plans: MembershipPlan[];
  selected: MembershipPlanId | null;
  onSelect: (id: MembershipPlanId) => void;
  disabled?: boolean;
}) {
  const monthly = plans.find((plan) => plan.id === "monthly");
  return (
    <fieldset className="membership-selector" disabled={disabled}>
      <legend>Choose your billing period</legend>
      <div className="membership-grid">
        {plans.map((plan) => {
          const saving = monthly
            ? Math.round(
                (1 - plan.amount / (monthly.amount * plan.months)) * 1000,
              ) / 10
            : 0;
          return (
            <label
              key={plan.id}
              className={`membership-card${selected === plan.id ? " selected" : ""}`}
            >
              <span className="membership-card-heading">
                <strong>{plan.label}</strong>
                <input
                  type="radio"
                  name="membership-plan"
                  value={plan.id}
                  checked={selected === plan.id}
                  onChange={() => onSelect(plan.id)}
                />
              </span>
              <span className="membership-price">{money(plan.amount)}</span>
              <span className="membership-cadence">
                Billed every {billingPeriod(plan.months)}
              </span>
              {plan.months > 1 && (
                <span>{money(plan.amount / plan.months)}/month equivalent</span>
              )}
              {saving > 0 && (
                <span className="membership-saving">
                  Save {saving}% compared with monthly
                </span>
              )}
              <span className="membership-upfront">
                {money(plan.amount)} charged upfront. Renews automatically until
                canceled.
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
