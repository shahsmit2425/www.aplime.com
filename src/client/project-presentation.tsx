import { ProjectDialog } from "./project-dialog.js";
import { ArrowLeft, CalendarDays, Clock3, House, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { money, type Project } from "../shared/domain.js";
import {
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { Badge, ServiceIcon } from "./ui.js";
import { projectStatusLabel } from "./marketplace-cards.js";
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
              <Badge>{projectStatusLabel(p)}</Badge>
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
  const rows: { label: string; value: ReactNode; wide?: boolean }[] = [
    { label: "Service", value: p.category },
    { label: "Status", value: <Badge>{projectStatusLabel(p)}</Badge> },
    { label: "ZIP code", value: p.zip },
    {
      label: "Posted",
      value: new Date(p.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
    { label: "Property type", value: property[p.propertyType] },
    { label: "Preferred timing", value: timing[p.urgency] },
    {
      label: "Appointment",
      value: p.scheduledAt
        ? new Date(p.scheduledAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Not scheduled",
    },
    {
      label: "Budget",
      value:
        p.budgetMin && p.budgetMax
          ? `${money(p.budgetMin)} – ${money(p.budgetMax)}`
          : p.budgetMax
            ? "Up to " + money(p.budgetMax)
            : p.budgetMin
              ? "From " + money(p.budgetMin)
              : "Not specified",
    },
    ...(p.proName ? [{ label: "Professional", value: p.proName }] : []),
    ...(p.amount !== null
      ? [{ label: "Agreed total", value: money(p.amount) }]
      : []),
    ...(p.address
      ? [
          {
            label: "Service address",
            value: [p.address, p.addressUnit].filter(Boolean).join(" "),
            wide: true,
          },
        ]
      : []),
    ...Object.entries(p.intake || {}).map(([key, value]) => ({
      label: questionLabel(p.category as ServiceCategory, key),
      value,
    })),
    { label: "Description", value: p.description, wide: true },
  ];
  return (
    <dl className="project-facts">
      {rows.map((r, i) => (
        <div key={r.label + i} data-wide={r.wide ? "true" : undefined}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
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

export function ProjectDetailsSurface({
  customer,
  open,
  onClose,
  children,
}: {
  customer: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!customer)
    return <div className="project-brief-passthrough">{children}</div>;
  return open ? (
    <ProjectDialog title="Project details" onClose={onClose}>
      <div className="project-detail-dialog-content">{children}</div>
    </ProjectDialog>
  ) : null;
}
