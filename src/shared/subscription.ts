export type MembershipPlanId = "monthly" | "six_month" | "yearly" | "legacy";
export interface MembershipPlan {
  id: MembershipPlanId;
  label: string;
  amount: number;
  currency: "usd";
  months: number;
}
export interface MembershipBilling {
  status: string;
  cancelAtPeriodEnd: boolean;
  configured: boolean;
  canManage: boolean;
  canEnroll: boolean;
  plans: MembershipPlan[];
  pricingProblem: string | null;
  currentPlan: MembershipPlan | null;
  periodEnd: string | null;
  // A change of billing period starts when the current period ends.
  canChange: boolean;
  pendingChange: { plan: MembershipPlan; effectiveAt: string } | null;
}

// The three billing periods of the one professional membership. The server
// refuses checkout unless the configured Stripe prices match these amounts,
// and the public pricing page shows the same figures.
export const membershipPeriods = [
  { id: "monthly", label: "Monthly", amount: 4000, months: 1 },
  { id: "six_month", label: "Six months", amount: 21000, months: 6 },
  { id: "yearly", label: "Annual", amount: 36000, months: 12 },
] as const;
