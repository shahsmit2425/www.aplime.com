import { Availability } from "./availability.js";
import type { Profile } from "../shared/domain.js";
import { businessFields, businessFieldGroups } from "../shared/business.js";
import { ServiceIcon, Badge } from "./ui.js";
export function BusinessDisplay({
  profile,
  preview = false,
}: {
  profile: Profile;
  preview?: boolean;
}) {
  const cover = profile.images?.find((i) => i.slot === "cover"),
    logo = profile.images?.find((i) => i.slot === "logo"),
    work = profile.images?.filter((i) => i.slot.startsWith("work-")) || [];
  return (
    <article className="business-showcase">
      <div className="business-cover">
        {cover ? (
          <img src={cover.url} alt={profile.business + " cover photo"} />
        ) : (
          <div className="business-cover-placeholder">
            <ServiceIcon service={profile.category} size={50} />
            <span>Home services, with a personal touch.</span>
          </div>
        )}
      </div>
      <div className="business-showcase-body">
        <div className="business-brand-row">
          <div className="business-logo">
            {logo ? (
              <img src={logo.url} alt={profile.business + " logo"} />
            ) : (
              <ServiceIcon service={profile.category} size={40} />
            )}
          </div>
          <div>
            <p className="eyebrow">
              {preview ? "YOUR SAVED PROFILE PREVIEW" : profile.category}
            </p>
            <h1>{profile.business}</h1>
            <p>
              {profile.details?.city
                ? `${profile.details.city}, ${profile.details.state}`
                : profile.zip}{" "}
              · {profile.category}
            </p>
          </div>
        </div>
        <div className="tags">
          <Badge>
            {profile.verified
              ? "Identity verified"
              : "Identity verification pending"}
          </Badge>
          <Badge>
            {profile.available
              ? "Accepting requests"
              : "Not accepting new requests"}
          </Badge>
          {profile.reviewCount > 0 && (
            <Badge>
              {profile.rating.toFixed(1)} / 5 · {profile.reviewCount} reviews
            </Badge>
          )}
        </div>
        <section>
          <h2>About the business</h2>
          <p className="business-description">{profile.bio}</p>
          <div className="business-facts">
            {profile.details?.yearsExperience !== undefined && (
              <div>
                <strong>
                  {profile.details?.yearsExperience ?? "Not listed"}
                </strong>
                <span>Years of experience</span>
              </div>
            )}
            {profile.details?.teamSize !== undefined && (
              <div>
                <strong>{profile.details?.teamSize ?? "Not listed"}</strong>
                <span>Team members</span>
              </div>
            )}
            <div>
              <strong>${profile.rate}</strong>
              <span>Starting hourly rate</span>
            </div>
          </div>
        </section>
        {work.length > 0 && (
          <section>
            <h2>Our work</h2>
            <div className="business-portfolio">
              {work.map((photo, index) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    loading="lazy"
                    src={photo.url}
                    alt={`${profile.business} work photo ${index + 1}`}
                  />
                </a>
              ))}
            </div>
          </section>
        )}
        {profile.details &&
          businessFieldGroups
            .filter((group) =>
              businessFields.some(
                (field) =>
                  (group.keys as readonly string[]).includes(field.key) &&
                  profile.details?.[field.key],
              ),
            )
            .map((group) => (
              <section key={group.title}>
                <h2>{group.title}</h2>
                {group.title.startsWith("Credentials") && (
                  <p className="muted">
                    Licensing and insurance details are provided by the business
                    and have not been independently verified by Aplime.
                  </p>
                )}
                <dl className="business-detail-list">
                  {businessFields
                    .filter(
                      (field) =>
                        (group.keys as readonly string[]).includes(field.key) &&
                        profile.details?.[field.key],
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
        <section>
          <Availability profile={profile} />
          <h2>Services</h2>
          <p>
            {profile.serviceCategories?.length
              ? profile.serviceCategories.join(" · ")
              : profile.category}
          </p>
          <p className="muted">
            Appointments and final pricing are agreed directly with your
            professional. Service payments are not processed by Aplime.
          </p>
        </section>
      </div>
    </article>
  );
}
