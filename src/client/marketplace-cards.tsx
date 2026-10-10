import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Star,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { money, type Project, type Profile } from "../shared/domain.js";
import { ServiceIcon } from "./ui.js";
const statusLabels: Record<Project["status"], string> = {
  requested: "Open request",
  quoted: "Reviewing estimates",
  booked: "Scheduled",
  in_progress: "In progress",
  paused: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Under review",
};
const urgencyLabels = {
  urgent: "As soon as possible",
  this_week: "This week",
  this_month: "This month",
  flexible: "Flexible timing",
};
export function ProjectCard({
  project: p,
  onOpen,
  compact = false,
}: {
  project: Project;
  onOpen: () => void;
  compact?: boolean;
}) {
  const appointment = p.scheduledAt
    ? new Date(p.scheduledAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const budget =
    p.budgetMin != null && p.budgetMax != null
      ? money(p.budgetMin) + " – " + money(p.budgetMax)
      : p.budgetMax != null
        ? "Up to " + money(p.budgetMax)
        : p.budgetMin != null
          ? "From " + money(p.budgetMin)
          : "Discuss an estimate";
  return (
    <button
      type="button"
      className={"project-card" + (compact ? " compact" : "")}
      onClick={onOpen}
      aria-label={"View project: " + p.title}
    >
      <span className="project-card-top">
        <span className="service-emblem" data-service={p.category}>
          <ServiceIcon service={p.category} size={23} />
        </span>
        <span className={"project-status status-" + p.status}>
          <i aria-hidden="true" />
          {statusLabels[p.status]}
        </span>
      </span>
      <span className="project-card-copy">
        <span className="card-kicker">{p.category}</span>
        <strong className="project-card-title">{p.title}</strong>
        {!compact && (
          <span className="project-card-description">{p.description}</span>
        )}
      </span>
      <span className="project-card-details">
        <span>
          <MapPin size={15} />
          {p.zip || "Location in project"}
        </span>
        <span>
          <CalendarDays size={15} />
          {appointment || urgencyLabels[p.urgency] || "Flexible timing"}
        </span>
      </span>
      <span className="project-card-footer">
        <span>
          <small>{compact ? "Your connection" : "Project budget"}</small>
          <strong>
            {compact
              ? p.proName || p.customerName || "Choose your professional"
              : budget}
          </strong>
        </span>
        <span className="card-open">
          {!compact && "View project"}
          <ArrowUpRight size={18} />
        </span>
      </span>
    </button>
  );
}
export function ProfessionalCard({
  profile: p,
  preview,
  actions,
  save,
  children,
}: {
  profile: Profile;
  preview?: boolean;
  actions: ReactNode;
  save: ReactNode;
  children?: ReactNode;
}) {
  const cover = p.images?.find((i) => i.slot === "cover"),
    logo = p.images?.find((i) => i.slot === "logo");
  return (
    <article className="professional-card">
      <div
        className={
          "professional-card-cover" + (!cover ? " professional-card-art" : "")
        }
        data-service={p.category}
      >
        {cover ? (
          <img
            src={cover.url}
            alt={p.business + " advertising image"}
            loading="lazy"
          />
        ) : (
          <>
            <ServiceIcon service={p.category} size={64} />
            <span>
              {p.category}
              <small>Local expertise. Personal care.</small>
            </span>
          </>
        )}
        <div className="professional-card-save">{save}</div>
      </div>
      <div className="professional-card-body">
        <div className="professional-card-identity">
          <div className="professional-card-logo">
            {logo ? (
              <img src={logo.url} alt={p.business + " logo"} loading="lazy" />
            ) : (
              <ServiceIcon service={p.category} size={29} />
            )}
          </div>
          <span className="professional-rating">
            <Star size={14} />
            {p.reviewCount ? (
              <>
                <strong>{p.rating.toFixed(1)}</strong>
                <span>({p.reviewCount})</span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </span>
        </div>
        <div className="professional-card-name">
          <h2>{p.business}</h2>
          <p>
            <MapPin size={14} />
            {p.zip}
            {p.serviceRadiusMiles > 0 &&
              " · Serves within " + p.serviceRadiusMiles + " miles"}
          </p>
        </div>
        <div className="professional-card-services">
          {p.serviceCategories.slice(0, 3).map((c) => (
            <span key={c}>{c}</span>
          ))}
          {p.serviceCategories.length > 3 && (
            <span>+{p.serviceCategories.length - 3} more</span>
          )}
        </div>
        <p className="professional-card-bio">{p.bio}</p>
        <div className="professional-card-facts">
          <span className={p.verified ? "verified-fact" : "pending-fact"}>
            {p.verified ? <ShieldCheck size={15} /> : <Clock3 size={15} />}{" "}
            {p.verified ? "Identity verified" : "Identity pending"}
          </span>
          <span className="professional-card-rate">
            <strong>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
                minimumFractionDigits: 0,
              }).format(p.rate)}
            </strong>{" "}
            /hr<small>Starting rate</small>
          </span>
        </div>
        {preview && (
          <p className="card-preview-note">
            Preview · Business setup in progress
          </p>
        )}
        {children}
        <div className="professional-card-actions">{actions}</div>
      </div>
    </article>
  );
}
export function CollectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <div className="collection-heading">
      <h2>
        {title}
        <span>{count}</span>
      </h2>
      {children && <p>{children}</p>}
    </div>
  );
}
