import { T } from "../shared/language.js";
import { useState, type ReactNode } from "react";
import { BusinessPortfolio } from "./business-portfolio.js";
import { portfolioImages } from "../shared/business-images.js";
import { ImagePreview } from "./image-preview.js";
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
          {p.status === "booked"
            ? p.awardAccepted === false
              ? "Awaiting pro confirmation"
              : p.scheduledAt
                ? "Scheduled"
                : "Accepted · choose a time"
            : statusLabels[p.status]}
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
          <T>{"View project"}</T> <ArrowUpRight size={18} />
        </span>
      </span>
      <span className="project-card-updates">
        <span>{pendingEstimates} pending estimates</span>
        {p.archived && (
          <strong>
            <T>{"Archived"}</T>
          </strong>
        )}
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
  const [expanded, setExpanded] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const cover = p.images?.find((i) => i.slot === "cover");
  const logo = p.images?.find((i) => i.slot === "logo");
  const photos = portfolioImages(p.images);
  const location = [p.details?.city, p.details?.state, p.zip]
    .filter(Boolean)
    .join(", ");
  const categories = p.serviceCategories.length
    ? p.serviceCategories
    : [p.category];
  return (
    <article
      className="pro-listing"
      data-layout={layout}
      data-service={p.category}
    >
      <header className="pro-listing-header">
        <div className="pro-listing-logo">
          {logo ? (
            <img src={logo.url} alt={p.business + " logo"} loading="lazy" />
          ) : (
            <ServiceIcon service={p.category} size={28} />
          )}
        </div>
        <div className="pro-listing-title">
          <h2>{p.business}</h2>
          <div className="pro-listing-rating">
            <Star size={16} aria-hidden="true" />
            {p.reviewCount > 0 ? (
              <>
                <strong>{p.rating.toFixed(1)}</strong>
                <span>
                  ({p.reviewCount} {p.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>
        </div>
        <div className="pro-listing-save">{save}</div>
      </header>
      <div className="pro-listing-location">
        <MapPin size={16} aria-hidden="true" />
        <span>
          {location || "Service area on profile"}
          {p.serviceRadiusMiles > 0 &&
            ` · Serves within ${p.serviceRadiusMiles} miles`}
        </span>
      </div>
      <div className="pro-listing-services">
        {(expanded ? categories : categories.slice(0, 3)).map((c) => (
          <span key={c}>{c}</span>
        ))}
        {categories.length > 3 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `+${categories.length - 3} more`}
          </button>
        )}
      </div>
      <div className="pro-listing-trust">
        {!p.verified && (
          <span className="pro-listing-pending">
            <Clock3 size={16} aria-hidden="true" />
            Identity pending
          </span>
        )}
        {p.verified && (
          <span>
            <ShieldCheck size={16} aria-hidden="true" />
            Identity verified
          </span>
        )}
        {!!p.details?.yearsExperience && (
          <span>
            <Clock3 size={16} aria-hidden="true" />
            {p.details.yearsExperience} years of experience
          </span>
        )}
      </div>
      {p.bio && <p className="pro-listing-bio">{p.bio}</p>}
      {photos.length > 0 ? (
        <BusinessPortfolio images={p.images} business={p.business} compact />
      ) : (
        cover && (
          <button
            className="pro-listing-ad"
            type="button"
            onClick={() => setShowCover(true)}
          >
            <img
              src={cover.url}
              alt={p.business + " advertising image"}
              loading="lazy"
            />
            <span>
              From the business<small>View advertising image</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
        )
      )}
      {preview && (
        <p className="card-preview-note">Not accepting requests yet</p>
      )}
      {children && <div className="pro-listing-project">{children}</div>}
      <footer className="pro-listing-footer">
        <div className="pro-listing-rate">
          <span>
            <strong>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
                minimumFractionDigits: 0,
              }).format(p.rate)}
            </strong>{" "}
            /hr
          </span>
          <small>Starting rate</small>
        </div>
        <div className="pro-listing-actions">{actions}</div>
      </footer>
      {showCover && cover && (
        <ImagePreview
          image={{ url: cover.url, name: p.business + " · Advertising image" }}
          onClose={() => setShowCover(false)}
        />
      )}
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
