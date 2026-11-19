import { request } from "./api.js";
import { T } from "../shared/language.js";
import { useState, useEffect, useRef, type ReactNode } from "react";
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
  type Upload,
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
export function projectStatusLabel(p: Project) {
  return p.status === "booked"
    ? p.awardAccepted === false
      ? "Awaiting pro confirmation"
      : p.scheduledAt
        ? "Scheduled"
        : "Accepted · choose a time"
    : statusLabels[p.status];
}
const urgencyLabels = {
  urgent: "As soon as possible",
  this_week: "This week",
  this_month: "This month",
  flexible: "Flexible timing",
};
function ProjectVisual({
  category,
  photo,
}: {
  category: string;
  photo?: Upload;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!photo || !element.current) return;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void request<{ url: string }>("/uploads/" + photo.id)
          .then(({ url }) => {
            if (active) setImage({ id: photo.id, url });
          })
          .catch(() => {
            /* Keep the service illustration if access or loading fails. */
          });
      },
      { rootMargin: "200px" },
    );
    observer.observe(element.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [photo?.id]);
  return (
    <span
      ref={element}
      className="project-card-visual"
      aria-hidden="true"
      data-service={category}
    >
      {image && image.id === photo?.id ? (
        <img
          src={image.url}
          alt=""
          loading="lazy"
          onError={() => setImage(null)}
        />
      ) : (
        <ServiceIcon service={category} size={54} />
      )}
    </span>
  );
}
export function ProjectCard({
  project: p,
  onOpen,
  quotes = [],
  photo,
}: {
  project: Project;
  onOpen: () => void;
  quotes?: Quote[];
  photo?: Upload;
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
  // A zero amount means the customer left that side of the budget open.
  const budget =
    p.budgetMin && p.budgetMax
      ? money(p.budgetMin) + " – " + money(p.budgetMax)
      : p.budgetMax
        ? "Up to " + money(p.budgetMax)
        : p.budgetMin
          ? "From " + money(p.budgetMin)
          : "Discuss an estimate";
  const hasUpdates =
    pendingEstimates > 0 ||
    !!p.archived ||
    !!p.completionRequested ||
    !!p.cancellationRequestedBy ||
    !!p.proposedAt;
  return (
    <button
      type="button"
      className="project-card"
      data-service={p.category}
      data-photo={photo ? "true" : undefined}
      onClick={onOpen}
      aria-label={"View project: " + p.title}
    >
      {photo && (
        <ProjectVisual key={p.id} category={p.category} photo={photo} />
      )}
      <span className="project-card-top">
        <span className="project-card-service">
          <span className="service-emblem" data-service={p.category}>
            <ServiceIcon service={p.category} size={20} />
          </span>
          <span className="card-kicker">{p.category}</span>
        </span>
        <span className={"project-status status-" + p.status}>
          <i aria-hidden="true" />
          {projectStatusLabel(p)}
        </span>
      </span>
      <span className="project-card-copy">
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
          <T>{"View project"}</T> <ArrowUpRight size={16} />
        </span>
      </span>
      {hasUpdates && (
        <span className="project-card-updates">
          {pendingEstimates > 0 && (
            <span>
              {pendingEstimates} pending{" "}
              {pendingEstimates === 1 ? "estimate" : "estimates"}
            </span>
          )}
          {p.archived && (
            <strong>
              <T>{"Archived"}</T>
            </strong>
          )}
          {p.completionRequested && <strong>Completion requested</strong>}
          {p.cancellationRequestedBy && <strong>Cancellation requested</strong>}
          {p.proposedAt && <strong>Appointment proposed</strong>}
        </span>
      )}
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
  compact = false,
}: {
  profile: Profile;
  layout?: "vertical" | "horizontal";
  compact?: boolean;
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
  if (compact)
    return (
      <article className="compact-professional" data-service={p.category}>
        <div className="compact-professional-main">
          <div className="compact-professional-avatar">
            {logo ? (
              <img src={logo.url} alt="" loading="lazy" />
            ) : (
              <ServiceIcon service={p.category} size={25} />
            )}
          </div>
          <div>
            <h3>{p.business}</h3>
            <p className="compact-professional-rating">
              <Star size={15} />{" "}
              {p.reviewCount > 0
                ? `${p.rating.toFixed(1)} (${p.reviewCount} ${p.reviewCount === 1 ? "review" : "reviews"})`
                : "No reviews yet"}
              {p.verified && (
                <span className="compact-professional-verified">
                  <ShieldCheck size={14} aria-hidden="true" /> Identity verified
                </span>
              )}
            </p>
            <small>
              {p.category} · {p.zip}
            </small>
          </div>
          <div className="compact-professional-save">{save}</div>
        </div>
        {preview && <small>Not accepting requests yet</small>}
        <div className="compact-professional-actions">{actions}</div>
        {children && (
          <div className="compact-professional-estimates">{children}</div>
        )}
      </article>
    );
  return (
    <article
      className="pro-listing"
      data-layout={layout}
      data-service={p.category}
    >
      {layout === "horizontal" && (
        <div className="pro-listing-featured-media">
          {cover || logo || photos[0] ? (
            <img
              src={(cover || logo || photos[0])!.url}
              alt={p.business}
              loading="lazy"
            />
          ) : (
            <ServiceIcon service={p.category} size={42} />
          )}
        </div>
      )}
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
        <details className="pro-listing-portfolio-disclosure">
          <summary>View work photos ({photos.length})</summary>
          <BusinessPortfolio images={p.images} business={p.business} compact />
        </details>
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
