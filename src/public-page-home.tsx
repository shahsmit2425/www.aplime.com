import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  FileCheck,
  FileText,
  Layers,
  LayoutGrid,
  MapPin,
  MessagesSquare,
  Mic,
  PhoneOff,
  Search,
  ShieldCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { categories } from "./shared/domain.js";
import { serviceSlug } from "./shared/service-questionnaires.js";
import { ServiceIcon } from "./client/ui.js";

const serviceName = (category: string) =>
  category === "HVAC" ? "Heating & Cooling" : category;

const featuredServices = [
  "Cleaning",
  "Landscaping",
  "Pest Control",
  "Plumbing",
  "Electrical",
].filter((name) => (categories as readonly string[]).includes(name));

const features = [
  {
    icon: Video,
    title: "Talk Before You Hire",
    text: "Audio or video calls with pros",
  },
  {
    icon: ShieldCheck,
    title: "Verified Professionals",
    text: "Identity checks & reviewed profiles",
  },
  {
    icon: CalendarDays,
    title: "Schedule on Your Terms",
    text: "Pick a time that works for you",
  },
  {
    icon: FileCheck,
    title: "Compare & Choose",
    text: "Itemized written estimates",
  },
  {
    icon: CircleDollarSign,
    title: "Free for Customers",
    text: "Post projects at no charge",
  },
];

const steps = [
  {
    icon: ClipboardList,
    title: "Post Your Project",
    points: [
      "Choose a service and your ZIP code",
      "Describe the job and add photos",
      "Free to post, no obligation to hire",
    ],
    href: "/app/projects/new",
    link: "Post a project",
  },
  {
    icon: MessagesSquare,
    title: "Talk & Compare",
    points: [
      "Message professionals privately",
      "Schedule an audio or video call",
      "Get itemized written estimates",
    ],
    href: "/how-it-works",
    link: "See how it works",
  },
  {
    icon: CalendarCheck,
    title: "Hire & Schedule",
    points: [
      "Choose the estimate you prefer",
      "Agree on an appointment time",
      "Leave a review when the job is done",
    ],
    href: "/trust-and-safety",
    link: "Read trust & safety",
  },
];

const facts = [
  {
    icon: LayoutGrid,
    value: String(categories.length),
    label: "Service Categories",
  },
  { icon: CircleDollarSign, value: "$0", label: "To Post a Project" },
  { icon: UsersRound, value: "Up to 5", label: "Matched Pros per Project" },
  { icon: FileText, value: "Itemized", label: "Written Estimates" },
  { icon: MapPin, value: "New Jersey", label: "Service Area" },
];

const reasons = [
  {
    icon: Video,
    title: "Talk Before You Hire",
    text: "Show the job on a call and ask questions before you decide.",
  },
  {
    icon: ShieldCheck,
    title: "Know What’s Verified",
    text: "Identity checks and profile review. Ask pros about licensing and insurance.",
  },
  {
    icon: Layers,
    title: "All in One Place",
    text: "Post, compare, schedule, and keep every message together.",
  },
];

const questions = [
  [
    "Is it free to request estimates?",
    "Yes. Customers can post a project and request estimates for free. Professionals set their own charges for the work; ask about any diagnostic or on-site assessment fees before agreeing to a visit.",
  ],
  [
    "Can I get an estimate without an in-person visit?",
    "Photos, messages, and scheduled calls can help a professional understand the project. Whether they can give a reliable estimate remotely depends on the work. Some projects require an inspection before a final price.",
  ],
  [
    "Am I committed to hiring someone when I post?",
    "No. Posting lets you explain your project and discuss it with professionals. You decide whether to proceed after reviewing the available estimates and details.",
  ],
  [
    "What should I include in my project request?",
    "Start with your ZIP code, the service you need, and a clear description. Photos, measurements, preferred timing, and details about materials or access help professionals understand the scope.",
  ],
];

export function HomePage() {
  return (
    <>
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-badge">
              <MapPin size={15} aria-hidden="true" />
              New Jersey’s Local Home Services Marketplace
            </p>
            <h1>
              Get Your Home Projects{" "}
              <span className="landing-accent">Done Right</span>
            </h1>
            <p className="landing-lede">
              Find local professionals, talk the job through on a video call,
              compare written estimates, and hire with confidence — all in one
              place.
            </p>
            <form
              className="landing-zip"
              action="/app/projects/new"
              method="get"
            >
              <label className="sr-only" htmlFor="hero-project-zip">
                Where is your project? Enter a ZIP code
              </label>
              <span className="landing-zip-field">
                <MapPin size={19} aria-hidden="true" />
                <input
                  id="hero-project-zip"
                  name="zip"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  required
                  placeholder="Enter ZIP code (e.g., 07054)"
                />
              </span>
              <button type="submit">
                <Search size={17} aria-hidden="true" />
                Find Professionals
              </button>
            </form>
            <p className="landing-chips">
              <span>Browse:</span>
              {featuredServices.map((name) => (
                <a href={"/services/" + serviceSlug(name)} key={name}>
                  {name}
                </a>
              ))}
            </p>
            <ul className="landing-checks">
              <li>
                <Check size={17} aria-hidden="true" />
                Free to post a project
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Identity-verified pros
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                No obligation to hire
              </li>
            </ul>
          </div>
          <div className="landing-hero-art">
            <img
              className="landing-hero-photo"
              src="/free-estimate-consultation.webp"
              alt="Illustrative scene of a homeowner discussing a project estimate with a home-service professional"
              width="1200"
              height="800"
              decoding="async"
              fetchPriority="high"
            />
            <div className="landing-call" aria-hidden="true">
              <span className="landing-call-tag">
                <Video size={15} />
                Video Estimate
              </span>
              <div className="landing-call-frame">
                <img
                  src="/services/plumbing.webp"
                  alt=""
                  width="600"
                  height="400"
                  decoding="async"
                />
                <div className="landing-call-controls">
                  <span>
                    <Mic size={15} />
                  </span>
                  <span>
                    <Video size={15} />
                  </span>
                  <span className="landing-call-end">
                    <PhoneOff size={15} />
                  </span>
                </div>
              </div>
            </div>
            <ul className="landing-call-steps" aria-label="On a video call">
              <li>
                <CircleCheck size={16} aria-hidden="true" />
                Discuss your project
              </li>
              <li>
                <CircleCheck size={16} aria-hidden="true" />
                Show the area live
              </li>
              <li>
                <CircleCheck size={16} aria-hidden="true" />
                Get a written estimate
              </li>
              <li>
                <CircleCheck size={16} aria-hidden="true" />
                Decide when you’re ready
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-wrap" aria-label="Why customers use Aplime">
        <ul className="landing-features">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={30} strokeWidth={1.7} aria-hidden="true" />
              <strong>{title}</strong>
              <small>{text}</small>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="landing-wrap landing-section"
        id="services"
        aria-labelledby="landing-services-title"
      >
        <div className="landing-heading">
          <div>
            <p className="landing-eyebrow">EXPLORE SERVICES</p>
            <h2 id="landing-services-title">
              All Your Home Service Needs in One Place
            </h2>
          </div>
          <a className="landing-link" href="/services">
            View All Services <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="home-service-grid">
          {categories.map((c) => (
            <a
              href={"/app/projects/new?category=" + encodeURIComponent(c)}
              className="home-service-tile"
              key={c}
            >
              <img
                className="home-service-photo"
                src={"/services/" + serviceSlug(c) + ".webp"}
                alt=""
                width="600"
                height="400"
                loading="lazy"
                decoding="async"
              />
              <span className="home-service-label">
                <ServiceIcon service={c} size={19} />
                {serviceName(c)}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="landing-wrap" aria-labelledby="landing-steps-title">
        <div className="landing-steps">
          <div className="landing-steps-intro">
            <p className="landing-pill">
              <span aria-hidden="true" />
              How Aplime Works
            </p>
            <h2 id="landing-steps-title">
              From Request to Hired in Three Steps
            </h2>
          </div>
          {steps.map(({ icon: Icon, title, points, href, link }) => (
            <article key={title}>
              <h3>
                <Icon size={21} aria-hidden="true" />
                {title}
              </h3>
              <ul>
                {points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <a className="landing-link" href={href}>
                {link} <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-facts" aria-label="Aplime at a glance">
        <ul className="landing-wrap">
          {facts.map(({ icon: Icon, value, label }) => (
            <li key={label}>
              <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
              <span>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="landing-wrap landing-section landing-answers"
        aria-labelledby="landing-answers-title"
      >
        <div>
          <h2 id="landing-answers-title">
            Real Questions.
            <br />
            Clear Answers.
          </h2>
          <p>
            What homeowners usually ask before they post their first project on
            Aplime.
          </p>
          <a className="landing-link" href="/faq">
            Read All FAQs <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="landing-answer-list">
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-wrap landing-section landing-why">
        <div className="landing-why-copy">
          <p className="landing-eyebrow">WHY APLIME</p>
          <h2>More Than a Directory — A Smarter Way to Hire</h2>
          <ul>
            {reasons.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-phone" aria-hidden="true">
          <div className="landing-phone-screen">
            <b>Your Project</b>
            <ol>
              <li>
                <CircleCheck size={18} />
                Project posted
              </li>
              <li>
                <CircleCheck size={18} />
                Video call scheduled
              </li>
              <li>
                <CircleCheck size={18} />
                Estimate received
              </li>
              <li className="landing-phone-next">
                <CalendarCheck size={18} />
                Appointment
              </li>
            </ol>
            <span>Compare estimates</span>
          </div>
        </div>
        <div className="landing-pro">
          <h2>
            <BriefcaseBusiness size={26} aria-hidden="true" />
            Are You a Professional?
          </h2>
          <p>
            Grow your business with local customers. Get matched to projects in
            your service and area, and manage messages, calls, estimates, and
            appointments in one workspace.
          </p>
          <ul>
            <li>
              <Check size={17} aria-hidden="true" />
              Reach local homeowners
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              Showcase your work & reviews
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              One membership, billed through Stripe
            </li>
          </ul>
          <div className="landing-pro-actions">
            <a className="landing-button" href="/app/register?role=pro">
              Join as a Professional <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="landing-link" href="/for-professionals#pricing">
              See membership pricing
            </a>
          </div>
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
            <h2>Ready to get your project started?</h2>
            <p>
              Post your project, talk with professionals, compare written
              estimates, and hire the right pro.
            </p>
          </div>
          <a href="/app/projects/new">
            Post a Project – It’s Free{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
