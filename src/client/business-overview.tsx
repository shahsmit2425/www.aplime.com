import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Profile } from "../shared/domain.js";
import { setupSteps } from "../shared/business-setup.js";
import { weekdays } from "../shared/preferences.js";
import { useWorkspace } from "./workspace.js";
import { ServiceIcon } from "./ui.js";

// The business at a glance: who customers see, and where each part of the
// account stands. Setup steps appear here once the checklist is finished.
export function BusinessOverview({ profile: p }: { profile: Profile }) {
  const { data, go } = useWorkspace();
  const logo = p.images?.find((image) => image.slot === "logo");
  const days = weekdays.filter((day) => p.weeklyHours?.[day]).length;
  const ready = setupSteps(p, !!data.membershipActive).every(
    (step) => step.complete,
  );
  const tiles = [
    ...(ready
      ? [
          {
            label: "Identity",
            value: "Verified",
            detail: "Photo ID and selfie confirmed",
            Icon: ShieldCheck,
            good: true,
            open: () => go("verification"),
          },
          {
            label: "Membership",
            value: "Active",
            detail: "Plan, billing and invoices",
            Icon: CreditCard,
            good: true,
            open: () => go("subscription"),
          },
          {
            label: "Marketplace review",
            value:
              p.reviewStatus === "pending"
                ? "Approved · changes in review"
                : p.reviewStatus === "changes_requested"
                  ? "Approved · changes requested"
                  : "Approved",
            detail: "How Aplime reviews your listing",
            Icon: ClipboardCheck,
            good: p.reviewStatus === "approved",
            open: () => go("profile", "setup"),
          },
        ]
      : []),
    {
      label: "Availability",
      value: p.available ? "Accepting new projects" : "Not accepting projects",
      detail:
        (days
          ? `Open ${days} ${days === 1 ? "day" : "days"} a week`
          : "No working hours published") +
        ` · up to ${p.serviceRadiusMiles} miles`,
      Icon: CalendarDays,
      good: p.available && days > 0,
      open: () => go("availability"),
    },
  ];
  return (
    <section className="business-overview" aria-label="Business overview">
      <header>
        <span className="business-overview-mark">
          {logo ? (
            <img src={logo.url} alt="" />
          ) : (
            <ServiceIcon service={p.category} size={28} />
          )}
        </span>
        <div>
          <h2>{p.business}</h2>
          <p>
            {p.category} professional · ZIP {p.zip} · from ${p.rate} / hour
            {p.reviewCount > 0 &&
              ` · ${p.rating.toFixed(1)} from ${p.reviewCount} ${p.reviewCount === 1 ? "review" : "reviews"}`}
          </p>
        </div>
        {p.listed && (
          <button
            type="button"
            className="secondary"
            onClick={() => go("pro", p.id)}
          >
            <UserRound size={17} aria-hidden="true" /> View public profile
          </button>
        )}
      </header>
      <ul>
        {tiles.map(({ label, value, detail, Icon, good, open }) => (
          <li key={label}>
            <button type="button" data-good={good || undefined} onClick={open}>
              <span className="business-overview-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <span>{detail}</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
