import { BusinessReviews } from "./reviews.js";
import { T } from "../shared/language.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MapPin,
  ShieldCheck,
  Clock3,
  Phone,
  Mail,
  Globe,
  Expand,
  X,
  Star,
  Navigation,
  BriefcaseBusiness,
} from "lucide-react";
import { Availability } from "./availability.js";
import { BusinessPortfolio } from "./business-portfolio.js";
import type { Profile } from "../shared/domain.js";
import { businessFields, businessFieldGroups } from "../shared/business.js";
import { ServiceIcon } from "./ui.js";

export function BusinessDisplay({
  profile,
  preview = false,
  actions,
}: {
  profile: Profile;
  preview?: boolean;
  actions?: ReactNode;
}) {
  const cover = profile.images?.find((i) => i.slot === "cover"),
    logo = profile.images?.find((i) => i.slot === "logo");
  const [view, setView] = useState<{ url: string; label: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (view) dialog.current?.showModal();
  }, [view]);
  const services = profile.serviceCategories?.length
    ? profile.serviceCategories
    : [profile.category];
  const location =
    [profile.details?.city, profile.details?.state]
      .filter(Boolean)
      .join(", ") || "ZIP " + profile.zip;
  const accepting =
    profile.available && !profile.suspended && profile.canRespond !== false;
  return (
    <article className="business-showcase business-profile-design">
      {preview && (
        <div className="profile-preview-label">
          <BriefcaseBusiness size={16} /> Your saved profile
        </div>
      )}
      <header className="profile-brand-header">
        <div className="profile-brand-mark">
          {logo ? (
            <button
              type="button"
              aria-label="View business logo"
              onClick={() => setView({ url: logo.url, label: "Business logo" })}
            >
              <img src={logo.url} alt={profile.business + " logo"} />
            </button>
          ) : (
            <ServiceIcon service={profile.category} size={42} />
          )}
        </div>
        <div className="profile-brand-copy">
          <h1>{profile.business}</h1>
          <p className="profile-location">
            <span>
              <ServiceIcon service={profile.category} size={16} />{" "}
              {profile.category} professional
            </span>
            <span>
              <MapPin size={16} /> {location}
            </span>
            <span>
              <Navigation size={16} /> Travels up to{" "}
              {profile.serviceRadiusMiles} miles
            </span>
          </p>
          <div className="profile-trust-row">
            <span
              className={
                profile.verified
                  ? "profile-trust verified"
                  : "profile-trust pending"
              }
            >
              <ShieldCheck size={16} />{" "}
              {profile.verified
                ? "Identity verified"
                : "Identity not yet verified"}
            </span>
            <span
              className={accepting ? "profile-trust" : "profile-trust pending"}
            >
              <Clock3 size={16} />{" "}
              {accepting ? "Accepting requests" : "Not accepting requests"}
            </span>
          </div>
        </div>
        <div className="profile-fact-strip">
          {profile.reviewCount > 0 && (
            <div>
              <strong>
                <Star size={20} fill="currentColor" aria-hidden="true" />{" "}
                {profile.rating.toFixed(1)}
              </strong>
              <span>
                {profile.reviewCount}{" "}
                {profile.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
          <div>
            <strong>
              ${profile.rate}
              <small> / hour</small>
            </strong>
            <span>Starting rate</span>
          </div>
          {profile.details?.yearsExperience !== undefined && (
            <div>
              <strong>{profile.details.yearsExperience} years</strong>
              <span>Experience (self-reported)</span>
            </div>
          )}
          {profile.details?.teamSize !== undefined && (
            <div>
              <strong>{profile.details.teamSize}</strong>
              <span>Team members</span>
            </div>
          )}
        </div>
      </header>
      <div className="profile-content-grid">
        <div className="profile-main-content">
          <BusinessPortfolio
            images={profile.images}
            business={profile.business}
          />
          <section className="profile-content-card">
            <h2>
              <T>{"About"}</T> {profile.business}
            </h2>
            <p className="business-description">{profile.bio}</p>
            <h3>Services</h3>
            <div className="profile-service-tags">
              {services.map((service) => (
                <span key={service}>
                  <ServiceIcon service={service} size={16} /> {service}
                </span>
              ))}
            </div>
          </section>
          {!preview && (
            <BusinessReviews
              key={profile.id}
              proId={profile.id}
              business={profile.business}
            />
          )}
          {profile.details &&
            businessFieldGroups
              .filter(
                (group) =>
                  !group.title.startsWith("Contact") &&
                  businessFields.some(
                    (field) =>
                      (group.keys as readonly string[]).includes(field.key) &&
                      profile.details?.[field.key],
                  ),
              )
              .map((group) => (
                <section className="profile-content-card" key={group.title}>
                  <h2>{group.title}</h2>
                  {group.title.startsWith("Credentials") && (
                    <p className="muted">
                      Reported by the business. Identity verification does not
                      verify licensing or insurance.
                    </p>
                  )}
                  <dl className="business-detail-list">
                    {businessFields
                      .filter(
                        (field) =>
                          (group.keys as readonly string[]).includes(
                            field.key,
                          ) && profile.details?.[field.key],
                      )
                      .map((field) => (
                        <div key={field.key}>
                          <dt>{field.label.replace(/ \(optional.*\)/, "")}</dt>
                          <dd>{profile.details?.[field.key]}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ))}
        </div>
        <aside
          className="profile-sidebar"
          aria-label="Business advertisement and contact"
        >
          {actions && (
            <section className="profile-content-card profile-contact-actions">
              <h2>
                <T>{"Discuss your project"}</T>
              </h2>
              {actions}
            </section>
          )}
          {cover && (
            <section className="profile-content-card profile-advertisement">
              <div className="profile-card-heading">
                <h2>From the business</h2>
                <span>Advertisement</span>
              </div>
              <button
                type="button"
                className="profile-advertisement-image"
                onClick={() =>
                  setView({
                    url: cover.url,
                    label: profile.business + " advertising image",
                  })
                }
                aria-label="View full advertising image"
              >
                <img
                  src={cover.url}
                  alt={profile.business + " advertising image"}
                />
                <span>
                  <Expand size={16} /> View full image
                </span>
              </button>
            </section>
          )}
          <section className="profile-content-card">
            <h2>Contact & service area</h2>
            <div className="profile-contact-list">
              {profile.details?.phone && (
                <a href={"tel:" + profile.details.phone.replace(/[^\d+]/g, "")}>
                  <Phone size={18} />
                  <span>
                    <small>Business phone</small>
                    {profile.details.phone}
                  </span>
                </a>
              )}
              {profile.details?.email && (
                <a href={"mailto:" + profile.details.email}>
                  <Mail size={18} />
                  <span>
                    <small>Business email</small>
                    {profile.details.email}
                  </span>
                </a>
              )}
              {profile.details?.website?.startsWith("https://") && (
                <a
                  href={profile.details.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe size={18} />
                  <span>
                    <small>Website</small>
                    {new URL(profile.details.website).hostname}
                  </span>
                </a>
              )}
              <div>
                <MapPin size={18} />
                <span>
                  <small>Based near</small>
                  {location}
                  <small>
                    Service radius: {profile.serviceRadiusMiles} miles
                  </small>
                </span>
              </div>
            </div>
          </section>
          <section className="profile-content-card">
            <Availability profile={profile} />
          </section>
        </aside>
      </div>
      <p className="profile-payment-note">
        Agree on scheduling and pricing directly with the professional. Aplime
        doesn’t collect payments, and identity verification doesn’t certify
        licensing, insurance or the quality of work.
      </p>
      {view && (
        <dialog
          ref={dialog}
          className="business-image-dialog"
          onCancel={() => setView(null)}
          onClose={() => setView(null)}
        >
          <div className="business-image-heading">
            <h2>{view.label}</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setView(null)}
              aria-label="Close image preview"
              autoFocus
            >
              <X size={18} /> <T>{"Close"}</T>{" "}
            </button>
          </div>
          <img src={view.url} alt={view.label} />
        </dialog>
      )}
    </article>
  );
}
