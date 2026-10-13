import { locationLabel } from "../shared/locations.js";
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
            {locationLabel(p)}
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
    </header>
  );
}
export function CustomerProjectDetails({ project: p }: { project: Project }) {
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
