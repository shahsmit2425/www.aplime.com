import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  ShieldCheck,
  Star,
} from "lucide-react";
import { setupSteps } from "../shared/business-setup.js";
import { useWorkspace } from "./workspace.js";

const stepIcons: Record<string, typeof Building2> = {
  profile: Building2,
  identity: ShieldCheck,
  membership: CreditCard,
  review: ClipboardCheck,
};
const sections = [
  {
    page: "profile",
    label: "Business profile",
    Icon: Building2,
    pages: ["profile", "onboarding", "verification"],
  },
  {
    page: "availability",
    label: "Services & hours",
    Icon: CalendarDays,
    pages: ["availability"],
  },
  { page: "reviews", label: "Reviews", Icon: Star, pages: ["reviews"] },
  {
    page: "subscription",
    label: "Membership",
    Icon: CreditCard,
    pages: ["subscription", "payments", "earnings"],
  },
];
// Section tabs for the professional's business pages. The setup checklist
// sits above them only until every step is complete.
export function BusinessNavigation() {
  const { data, page, id, go } = useWorkspace();
  const steps = setupSteps(
    data.profiles.find((p) => p.id === data.user.id),
    !!data.membershipActive,
  );
  const done = steps.filter((step) => step.complete).length;
  const next = steps.find((step) => !step.complete);
  return (
    <section className="business-hub">
      {next && (
        <nav className="business-setup" aria-label="Business setup">
          <header>
            <div>
              <h2>Finish setting up your business</h2>
              <p>
                Customers can find you once all four steps are complete. Next:{" "}
                {next.label.toLowerCase()}.
              </p>
            </div>
            <strong>
              {done} of {steps.length} complete
            </strong>
          </header>
          <ol>
            {steps.map((step, index) => {
              const Icon = step.complete ? CheckCircle2 : stepIcons[step.key];
              const current =
                page === step.page &&
                (step.id ? id === step.id : id !== "setup");
              return (
                <li key={step.key}>
                  <button
                    type="button"
                    data-complete={step.complete || undefined}
                    data-next={step === next || undefined}
                    aria-current={current ? "step" : undefined}
                    onClick={() => go(step.page, step.id)}
                  >
                    <span className="business-setup-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span>
                      <small>Step {index + 1}</small>
                      <strong>{step.label}</strong>
                      <span>{step.detail}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <nav className="business-tabs" aria-label="Business account sections">
        {sections.map(({ page: target, label, Icon, pages }) => (
          <button
            key={target}
            type="button"
            aria-current={pages.includes(page) ? "page" : undefined}
            onClick={() => go(target)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </section>
  );
}
