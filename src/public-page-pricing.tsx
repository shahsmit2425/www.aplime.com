import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  CircleDollarSign,
  FileText,
  Layers,
  MessageCircle,
  MessagesSquare,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
  Video,
} from "lucide-react";
import { membershipPeriods } from "./shared/subscription.js";

const dollars = (cents: number) => {
  const value = cents / 100;
  return "$" + (Number.isInteger(value) ? value : value.toFixed(2));
};
const monthly = membershipPeriods[0].amount;
const periods = membershipPeriods.map((period) => ({
  ...period,
  perMonth: period.amount / period.months,
  saving:
    Math.round((1 - period.amount / (monthly * period.months)) * 1000) / 10,
  cadence:
    period.months === 1
      ? "Billed every month"
      : period.months === 12
        ? dollars(period.amount) + " billed every year"
        : dollars(period.amount) + ` billed every ${period.months} months`,
}));
const lowest = Math.min(...periods.map((period) => period.perMonth));
const periodNotes: Record<(typeof periods)[number]["id"], string> = {
  monthly: "Pay month to month.",
  six_month: "Pay twice a year at a lower monthly rate.",
  yearly: "Pay once a year at the lowest monthly rate.",
};
const periodIcons = {
  monthly: BriefcaseBusiness,
  six_month: Layers,
  yearly: Star,
};

const points = [
  {
    icon: Layers,
    title: "One membership",
    text: "The same features on every billing period",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed listings",
    text: "Stripe Identity check and Aplime profile review",
  },
  {
    icon: UsersRound,
    title: "Matched local projects",
    text: "In your service category and service radius",
  },
];

const included = [
  "A business profile with your services, photos and reviews",
  "Matching projects in your category and service radius",
  "Private messages with customers",
  "Audio and video calls to scope the job",
  "Itemized written estimates",
  "Appointment scheduling and project updates",
];

const tools = [
  {
    icon: CircleDollarSign,
    title: "No Per-Lead Fees",
    text: "The membership is Aplime’s only charge",
  },
  {
    icon: Search,
    title: "Profile Visibility",
    text: "A public profile customers can read",
  },
  {
    icon: MessagesSquare,
    title: "Customer Messaging",
    text: "Talk to homeowners before you visit",
  },
  {
    icon: Video,
    title: "Audio & Video Calls",
    text: "See the job without a trip",
  },
  {
    icon: FileText,
    title: "Written Estimates",
    text: "Send itemized estimates",
  },
  {
    icon: Star,
    title: "Customer Reviews",
    text: "Reviews from completed projects",
  },
  {
    icon: CalendarCheck,
    title: "Scheduling",
    text: "Agree on appointment times",
  },
];

const steps = [
  [
    "Build your listing",
    "Add business details, service coverage, policies, credentials, a logo or cover, and examples of work.",
  ],
  [
    "Verify and subscribe",
    "Verify your identity through Stripe Identity, choose a billing period, and submit your saved listing for Aplime review.",
  ],
  [
    "Receive matching projects",
    "Approved, subscribed businesses receive matching projects in their category and configured service radius.",
  ],
  [
    "Talk, estimate, schedule",
    "Ask questions, use private calls, send itemized estimates, and confirm appointment and completion updates.",
  ],
];

const questions = [
  [
    "Do you charge per lead or per estimate?",
    "No. The membership is Aplime’s only charge to professionals. There is no fee per project match, message, call, or estimate.",
  ],
  [
    "How do customers pay me?",
    "Customers and professionals arrange payment for the work directly. Aplime does not process project payments.",
  ],
  [
    "Is there a difference between the billing periods?",
    "No. Every billing period includes the same professional membership. Six-month and annual billing cost less per month and are charged upfront.",
  ],
  [
    "Can I cancel?",
    "Yes. Cancel renewal from Manage billing in your account. Your membership continues through the billing period you have paid for.",
  ],
  [
    "What do I need before customers can find me?",
    "A saved business profile, identity verification through Stripe Identity, an active membership, and Aplime’s review of your profile.",
  ],
];

const join = "/app/register?role=pro";

export function ProfessionalsPage() {
  return (
    <>
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-badge">
              <BriefcaseBusiness size={15} aria-hidden="true" />
              For Service Professionals
            </p>
            <h1>
              Simple Pricing for Service{" "}
              <span className="landing-accent">Professionals</span>
            </h1>
            <p className="landing-lede">
              Grow your business locally on Aplime. Talk to customers before you
              visit, send written estimates, and manage your projects in one
              place — with no per-lead fees.
            </p>
            <div className="pricing-hero-actions">
              <a className="landing-button" href={join}>
                Join as a Professional{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="landing-link" href="#pricing">
                See pricing
              </a>
            </div>
            <ul className="landing-checks">
              <li>
                <Check size={17} aria-hidden="true" />
                No per-lead fees
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Customers pay you directly
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Cancel renewal anytime
              </li>
            </ul>
          </div>
          <div className="landing-hero-art">
            <img
              className="landing-hero-photo"
              src="/services/handyman.webp"
              alt=""
              width="600"
              height="400"
              decoding="async"
              fetchPriority="high"
            />
            <ul className="pricing-hero-card" aria-label="With a membership">
              <li>
                <MessageCircle size={18} aria-hidden="true" />
                Message customers
              </li>
              <li>
                <FileText size={18} aria-hidden="true" />
                Send written estimates
              </li>
              <li>
                <CalendarCheck size={18} aria-hidden="true" />
                Schedule appointments
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-wrap" aria-label="Membership at a glance">
        <ul className="pricing-points">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={30} strokeWidth={1.7} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="landing-wrap landing-section"
        id="pricing"
        aria-labelledby="pricing-title"
      >
        <p className="landing-eyebrow">MEMBERSHIP PRICING</p>
        <h2 id="pricing-title">One Membership. Choose How You Pay.</h2>
        <p className="pricing-intro">
          Every billing period includes the same professional membership. Longer
          periods cost less per month.
        </p>
        <div className="pricing-plans">
          {periods.map((period) => {
            const Icon = periodIcons[period.id];
            const best = period.perMonth === lowest;
            return (
              <article
                className={best ? "pricing-plan best" : "pricing-plan"}
                key={period.id}
              >
                {best && (
                  <p className="pricing-plan-flag">
                    <BadgeCheck size={15} aria-hidden="true" />
                    Lowest monthly rate
                  </p>
                )}
                <header>
                  <span className="pricing-plan-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{period.label}</h3>
                    <p>{periodNotes[period.id]}</p>
                  </div>
                </header>
                <p className="pricing-plan-price">
                  <strong>{dollars(period.perMonth)}</strong>
                  <span>/mo</span>
                  {period.saving > 0 && <em>{`Save ${period.saving}%`}</em>}
                </p>
                <p className="pricing-plan-cadence">{period.cadence}</p>
                <a
                  className={best ? "landing-button" : "pricing-plan-button"}
                  href={join}
                >
                  Get Started
                </a>
              </article>
            );
          })}
        </div>
        <div className="pricing-included">
          <h3>Every billing period includes</h3>
          <ul>
            {included.map((item) => (
              <li key={item}>
                <Check size={17} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="pricing-note">
          Prices are in US dollars. Each billing period is charged upfront and
          renews automatically until you cancel. You choose a billing period in
          your account, and Stripe shows the final recurring charge before you
          confirm. Appearing to customers also requires identity verification
          and Aplime’s review of your profile.
        </p>
      </section>

      <section className="landing-wrap" aria-label="What members use">
        <ul className="pricing-tools">
          {tools.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
              <strong>{title}</strong>
              <small>{text}</small>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="landing-wrap landing-section pricing-steps"
        aria-labelledby="pricing-steps-title"
      >
        <div>
          <p className="landing-eyebrow">HOW IT WORKS FOR PROS</p>
          <h2 id="pricing-steps-title">From Listing to Booked Jobs</h2>
          <p>
            Four steps take you from a new account to projects that match your
            services and area.
          </p>
        </div>
        <ol>
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span aria-hidden="true">{index + 1}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="landing-wrap landing-section landing-answers"
        aria-labelledby="pricing-answers-title"
      >
        <div>
          <p className="landing-eyebrow">FAQ</p>
          <h2 id="pricing-answers-title">
            Common Questions from Professionals
          </h2>
          <p>Answers about pricing, billing, and how Aplime works for pros.</p>
          <a className="landing-link" href="/faq">
            Read All FAQs <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="landing-answer-list pricing-answer-list">
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-wrap">
        <div className="landing-cta">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path
              d="M8 53V29L32 9L56 29V53M23 53H42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <h2>Join Aplime Today</h2>
            <p>
              Create your account, build your business profile, and choose the
              billing period that fits your business.
            </p>
          </div>
          <a href={join}>
            Get Started Now <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
