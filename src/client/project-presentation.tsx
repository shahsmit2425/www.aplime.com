import { T } from "../shared/language.js";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileText,
  House,
  MapPin,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { money, type Project } from "../shared/domain.js";
import {
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { Badge, ServiceIcon } from "./ui.js";
const property = {
  home: "Single-family home",
  apartment: "Apartment",
  condo: "Condo",
  commercial: "Commercial",
  other: "Other",
};
const timing = {
  urgent: "As soon as possible",
  this_week: "This week",
  this_month: "This month",
  flexible: "Flexible",
};
export function CustomerProjectHeader({
  project: p,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  return (
    <header className="customer-project-hero">
      <button className="text-button project-back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to dashboard
      </button>
      <div className="project-brief-header">
        <div className="project-brief-identity">
          <span className="project-brief-icon">
            <ServiceIcon service={p.category} size={30} />
          </span>
          <div>
            <div className="project-brief-title">
              <h1>{p.title}</h1>
              <Badge>{p.status.replaceAll("_", " ")}</Badge>
            </div>
            <p>{p.description}</p>
          </div>
        </div>
        <dl className="project-brief-meta">
          <div>
            <dt>
              <ServiceIcon service={p.category} size={20} /> Category
            </dt>
            <dd>{p.category}</dd>
          </div>
          <div>
            <dt>
              <House size={20} /> Property type
            </dt>
            <dd>{property[p.propertyType]}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={20} /> ZIP
            </dt>
            <dd>{p.zip}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays size={20} /> Posted
            </dt>
            <dd>
              {new Date(p.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
export function CustomerProjectDetails({ project: p }: { project: Project }) {
  const rows: { label: string; value: ReactNode; icon: ReactNode }[] = [
    { label: "Project title", value: p.title, icon: <FileText size={17} /> },
    {
      label: "Service",
      value: p.category,
      icon: <ServiceIcon service={p.category} size={17} />,
    },
    { label: "ZIP code", value: p.zip, icon: <MapPin size={17} /> },
    {
      label: "Posted",
      value: new Date(p.createdAt).toLocaleDateString(),
      icon: <CalendarDays size={17} />,
    },
    ...Object.entries(p.intake || {}).map(([key, value]) => ({
      label: questionLabel(p.category as ServiceCategory, key),
      value,
      icon: <ServiceIcon service={p.category} size={17} />,
    })),
    {
      label: "Property type",
      value: property[p.propertyType],
      icon: <House size={17} />,
    },
    {
      label: "Preferred timing",
      value: timing[p.urgency],
      icon: <Clock3 size={17} />,
    },
    {
      label: "Appointment",
      value: p.scheduledAt
        ? new Date(p.scheduledAt).toLocaleString()
        : "Not scheduled",
      icon: <CalendarDays size={17} />,
    },
    {
      label: "Customer",
      value: p.customerName || "You",
      icon: <UserRound size={17} />,
    },
    ...(p.address
      ? [
          {
            label: "Service address",
            value: [p.address, p.addressUnit].filter(Boolean).join(" "),
            icon: <MapPin size={17} />,
          },
        ]
      : []),
    {
      label: "Customer budget",
      value:
        p.budgetMin === null && p.budgetMax === null
          ? "Not specified"
          : `${p.budgetMin === null ? "Any" : money(p.budgetMin)} – ${p.budgetMax === null ? "Any" : money(p.budgetMax)}`,
      icon: <CircleDollarSign size={17} />,
    },
    {
      label: "Status",
      value: <Badge>{p.status.replace("_", " ")}</Badge>,
      icon: <Clock3 size={17} />,
    },
    ...(p.proName
      ? [
          {
            label: "Professional",
            value: p.proName,
            icon: <UserRound size={17} />,
          },
        ]
      : []),
    ...(p.amount !== null
      ? [
          {
            label: "Agreed total",
            value: money(p.amount),
            icon: <CircleDollarSign size={17} />,
          },
        ]
      : []),
    {
      label: "Project note",
      value: p.description,
      icon: <FileText size={17} />,
    },
  ];
  return (
    <>
      <div className="project-section-heading">
        <h2>
          <T>{"Project details"}</T>
        </h2>
      </div>
      <dl className="project-detail-rows">
        {rows.map((r, i) => (
          <div key={r.label + i}>
            <dt>
              <span>{r.icon}</span>
              {r.label}
            </dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function CustomerProjectStatus({ project: p }: { project: Project }) {
  const steps = [
    {
      status: "requested",
      label: "Requested",
      text: "Find matching professionals",
    },
    { status: "quoted", label: "Estimates", text: "Review written estimates" },
    {
      status: "booked",
      label: "Professional chosen",
      text: "Confirm the project arrangements",
    },
    {
      status: "in_progress",
      label: "In progress",
      text: "Keep in touch as work progresses",
    },
    {
      status: "completed",
      label: "Completed",
      text: "Share your experience in a review",
    },
  ];
  const stage = p.status === "paused" ? p.pausedFrom : p.status;
  const index = steps.findIndex((step) => step.status === stage);
  return (
    <section
      className="panel project-status-panel"
      aria-labelledby="project-status-heading"
    >
      <h2 id="project-status-heading">
        <Clock3 size={21} /> Project status
      </h2>
      {["paused", "cancelled", "disputed"].includes(p.status) && (
        <p>
          <Badge>{p.status}</Badge>
        </p>
      )}
      <ol className="project-status-track">
        {steps.map((step, i) => (
          <li
            key={step.status}
            data-state={i === index ? "current" : i < index ? "past" : "future"}
            aria-current={i === index ? "step" : undefined}
          >
            <strong>{step.label}</strong>
            <small>{step.text}</small>
          </li>
        ))}
      </ol>
      {p.scheduledAt && (
        <p className="muted">
          Appointment: {new Date(p.scheduledAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}
