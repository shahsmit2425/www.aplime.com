import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  FileText,
  House,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { money, type Project } from "../shared/domain.js";
import {
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { Badge, ServiceIcon } from "./ui.js";
const stages = ["requested", "quoted", "booked", "in_progress", "completed"];
const steps = [
  ["Request", "Project posted"],
  ["Compare pros", "Review and choose"],
  ["Book", "Confirm details"],
  ["Work", "Service in progress"],
  ["Review", "Share feedback"],
];
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
  const stage = stages.indexOf(
    p.status === "paused" ? p.pausedFrom || "requested" : p.status,
  );
  return (
    <header className="customer-project-hero">
      <div className="project-hero-copy">
        <button className="text-button project-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
        <div className="project-hero-title">
          <h1>{p.title}</h1>
          <Badge>{p.status.replace("_", " ")}</Badge>
        </div>
        <div className="project-hero-meta">
          <span>
            <ServiceIcon service={p.category} size={16} />
            {p.category}
          </span>
          <span>
            <House size={16} />
            {property[p.propertyType]}
          </span>
          <span>
            <MapPin size={16} />
            {p.zip}
          </span>
          <span>
            <CalendarDays size={16} />
            Posted{" "}
            {new Date(p.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <p>{p.description}</p>
      </div>
      {stage >= 0 && (
        <ol className="project-progress" aria-label="Project progress">
          {steps.map(([label, caption], i) => (
            <li
              key={label}
              className={i < stage ? "complete" : i === stage ? "current" : ""}
              aria-current={i === stage ? "step" : undefined}
            >
              <span className="progress-number">
                {i < stage ? <Check size={17} /> : i + 1}
              </span>
              <div>
                <strong>{label}</strong>
                <small>{caption}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </header>
  );
}
export function CustomerProjectDetails({
  project: p,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  const rows: { label: string; value: ReactNode; icon: ReactNode }[] = [
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
        <h2>Project details</h2>
        {["requested", "quoted"].includes(p.status) && (
          <button className="secondary" onClick={onEdit}>
            <Pencil size={15} />
            Edit
          </button>
        )}
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
