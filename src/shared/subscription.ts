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
}
