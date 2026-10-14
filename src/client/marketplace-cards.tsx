import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Star,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import {
  money,
  type Project,
  type Profile,
  type Quote,
} from "../shared/domain.js";
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
  quotes = [],
}: {
  project: Project;
  onOpen: () => void;
  quotes?: Quote[];
}) {
  const pendingEstimates = quotes.filter(
    (q) =>
      q.projectId === p.id &&
      !q.assessmentRequired &&
      q.status === "pending" &&
      (!q.expiresAt || Date.parse(q.expiresAt) > Date.now()),
  ).length;
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
      className="project-card"
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
        <span className="project-card-description">{p.description}</span>
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
          <small>Project budget</small>
          <strong>{budget}</strong>
        </span>
        <span className="card-open">
          View project
          <ArrowUpRight size={18} />
        </span>
      </span>
      <span className="project-card-updates">
        <span>{pendingEstimates} pending estimates</span>
        {p.archived && <strong>Archived</strong>}
        {p.completionRequested && <strong>Completion requested</strong>}
        {p.cancellationRequestedBy && <strong>Cancellation requested</strong>}
        {p.proposedAt && <strong>Appointment proposed</strong>}
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
  layout = "vertical",
}: {
  profile: Profile;
  layout?: "vertical" | "horizontal";
  preview?: boolean;
  actions: ReactNode;
  save: ReactNode;
  children?: ReactNode;
}) {
  const cover = p.images?.find((i) => i.slot === "cover"),
    logo = p.images?.find((i) => i.slot === "logo");
  return (
    <article
      className={
        "professional-card" +
        (layout === "horizontal" ? " professional-card-horizontal" : "")
      }
      data-service={p.category}
    >
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
              <small>Home services</small>
            </span>
          </>
        )}
        {cover && (
          <span className="professional-service-ribbon">
            <ServiceIcon service={p.category} size={14} />
            {p.category}
          </span>
        )}
        <div className="professional-card-save">{save}</div>
      </div>
      <div className="professional-card-body">
        <div className="professional-card-content">
          <div className="professional-card-identity">
            <div className="professional-card-logo">
              {logo ? (
                <img src={logo.url} alt={p.business + " logo"} loading="lazy" />
              ) : (
                <ServiceIcon service={p.category} size={29} />
              )}
            </div>
            <div className="professional-card-heading">
              <h2>{p.business}</h2>
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
          </div>
          <div className="professional-card-name">
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

          {preview && (
            <p className="card-preview-note">Not accepting requests yet</p>
          )}
          {children}
        </div>
        <div className="professional-card-sidebar">
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
          <div className="professional-card-actions">{actions}</div>
        </div>
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
