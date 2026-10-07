import type Stripe from "stripe";
import type {
  MembershipPlan,
  MembershipPlanId,
} from "../shared/subscription.js";
import { env } from "./config.js";
import { fail } from "./errors.js";
import { stripe } from "./integrations/stripe.js";

type PlanSpec = {
  id: MembershipPlanId;
  label: string;
  priceId: string;
  amount?: number;
  months?: number;
};
export function membershipSpecs(): PlanSpec[] {
  const specs: PlanSpec[] = [
    {
      id: "monthly",
      label: "Monthly",
      priceId: env.STRIPE_PRO_MONTHLY_PRICE_ID,
      amount: 4000,
      months: 1,
    },
    {
      id: "six_month",
      label: "Six months",
      priceId: env.STRIPE_PRO_SIX_MONTH_PRICE_ID,
      amount: 21000,
      months: 6,
    },
    {
      id: "yearly",
      label: "Annual",
      priceId: env.STRIPE_PRO_YEARLY_PRICE_ID,
      amount: 36000,
      months: 12,
    },
  ];
  if (specs.some((spec) => spec.priceId)) {
    if (
      specs.some((spec) => !spec.priceId) ||
      new Set(specs.map((spec) => spec.priceId)).size !== 3
    )
      fail(
        503,
        "Membership plans are not configured correctly. Please contact support.",
      );
    return specs;
  }
  return env.STRIPE_PRO_PRICE_ID
    ? [
        {
          id: "legacy",
          label: "Professional membership",
          priceId: env.STRIPE_PRO_PRICE_ID,
        },
      ]
    : [];
}

function specForPrice(priceId: string): PlanSpec | undefined {
  return (
    membershipSpecs().find((spec) => spec.priceId === priceId) ||
    (env.STRIPE_PRO_PRICE_ID === priceId
      ? { id: "legacy", label: "Previous membership", priceId }
      : undefined)
  );
}

// Existing subscriptions may keep an archived price. New enrollment requires an active price.
export function membershipForPrice(
  price: Stripe.Price,
  enrollment = false,
): MembershipPlan | null {
  const spec = specForPrice(price.id);
  const recurring = price.recurring;
  if (
    !spec ||
    !recurring ||
    price.type !== "recurring" ||
    price.currency !== "usd" ||
    price.livemode !== (env.APP_ENV === "production") ||
    (enrollment && !price.active) ||
    recurring.usage_type !== "licensed" ||
    !Number.isInteger(price.unit_amount) ||
    (price.unit_amount ?? 0) <= 0
  )
    return null;
  const months =
    recurring.interval === "year"
      ? recurring.interval_count * 12
      : recurring.interval === "month"
        ? recurring.interval_count
        : 0;
  if (
    !months ||
    (spec.amount !== undefined &&
      (price.unit_amount !== spec.amount || months !== spec.months))
  )
    return null;
  return {
    id: spec.id,
    label: spec.label,
    amount: price.unit_amount!,
    currency: "usd",
    months,
  };
}

const priceCache = new Map<string, { expires: number; price: Stripe.Price }>();
export async function membershipPlans(): Promise<MembershipPlan[]> {
  return Promise.all(
    membershipSpecs().map(async (spec) => {
      const key = env.APP_ENV + ":" + spec.priceId;
      const cached = priceCache.get(key);
      const price =
        cached && cached.expires > Date.now()
          ? cached.price
          : await stripe().prices.retrieve(spec.priceId);
      const plan = membershipForPrice(price, true);
      if (!plan)
        fail(
          503,
          "Membership pricing does not match the configured plan. Please contact support.",
        );
      priceCache.set(key, { expires: Date.now() + 60000, price });
      return plan;
    }),
  );
}

export function subscriptionMembership(
  subscription: Stripe.Subscription,
): MembershipPlan | null {
  const items = subscription.items.data;
  return items.length === 1 && items[0].quantity === 1
    ? membershipForPrice(items[0].price)
    : null;
}
