import {
  Building2,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import type { Profile } from "../shared/domain.js";

export function ProfessionalSetup({
  profile,
  current,
  identityVerified = profile?.verified,
  membershipActive,
  go,
}: {
  profile?: Profile;
  current: "profile" | "verification" | "subscription";
  identityVerified?: boolean;
  membershipActive?: boolean;
  go: (page: string, id?: string) => void;
}) {
  const steps = [
    {
      page: "profile",
      label: "Business profile",
      detail: profile ? "Details saved" : "Introduce your business",
      complete: !!profile,
      Icon: Building2,
    },
    {
      page: "verification",
      label: "Verify identity",
      detail: identityVerified ? "Identity confirmed" : "Photo ID and selfie",
      complete: !!identityVerified,
      Icon: ShieldCheck,
    },
    {
      page: "subscription",
      label: "Membership",
      detail: membershipActive
        ? "Membership active"
        : "Choose or manage your plan",
      complete: !!membershipActive,
      Icon: CreditCard,
    },
    {
      page: "review",
      label: "Marketplace review",
      detail: profile?.suspended
        ? "Contact support"
        : profile?.listed
          ? "Listing approved"
          : profile?.reviewStatus === "pending"
            ? "Review in progress"
            : "Submit your finished profile",
      complete: !!profile?.listed && !profile.suspended,
      Icon: ClipboardCheck,
    },
  ];
  return (
    <nav className="professional-setup" aria-label="Professional account setup">
      <ol>
        {steps.map(({ page, label, detail, complete, Icon }, index) => (
          <li key={page}>
            <button
              type="button"
              className={`setup-link${current === page ? " current" : ""}${complete ? " complete" : ""}`}
              aria-current={current === page ? "step" : undefined}
              onClick={() =>
                page === "review" ? go("profile", "setup") : go(page)
              }
            >
              <span className="setup-link-icon">
                {complete ? (
                  <CheckCircle2 size={21} aria-hidden="true" />
                ) : (
                  <Icon size={21} aria-hidden="true" />
                )}
              </span>
              <span>
                <small>STEP {index + 1}</small>
                <strong>{label}</strong>
                <span>{detail}</span>
              </span>
              <ArrowRight
                className="setup-link-arrow"
                size={16}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
