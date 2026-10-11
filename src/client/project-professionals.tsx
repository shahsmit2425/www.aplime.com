import {
  CalendarDays,
  Users,
  Image,
  BriefcaseBusiness,
  MapPin,
  Phone,
  Video,
  ShieldCheck,
  Star,
} from "lucide-react";
import { money, type Project, type Quote } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { ServiceIcon, Badge } from "./ui.js";
import { ChatWithPro, SavePro } from "./project-actions.js";
import { request, openExternal } from "./api.js";
import { projectProfessionals, estimateCanBeAccepted } from "./project-hub.js";
export function ProjectProfessionals({
  project: p,
  submit,
}: {
  project: Project;
  submit: (body: unknown) => Promise<unknown>;
}) {
  const { data, go, run, busy } = useWorkspace();
  const quotes = data.quotes.filter((q) => q.projectId === p.id);
  const profiles = projectProfessionals(
    p,
    data.profiles,
    quotes,
    data.discoveryMode === "open",
  );
  // Retain estimate records even if a professional's profile is no longer available.
  const ids = [
    ...new Set([
      ...profiles.map((f) => f.id),
      ...quotes.map((q) => q.proId),
      ...(p.proId ? [p.proId] : []),
    ]),
  ];
  const ordered = [...ids].sort(
    (a, b) => Number(b === p.proId) - Number(a === p.proId),
  );
  const open = ["requested", "quoted"].includes(p.status);
  const accept = (q: Quote, business: string) => {
    if (
      !window.confirm(
        `Accept ${money(q.amount)} from ${business}? This professional must confirm the job. Your other estimates stay on hold until they do.`,
      )
    )
      return;
    void run(
      () => submit({ type: "accept", quoteId: q.id, revision: q.revision }),
      "Estimate selected. The professional must confirm the job before work starts.",
    );
  };
  const call = (audioOnly: boolean) =>
    void run(async () => {
      const result = await request("/projects/" + p.id + "/call", {
        audioOnly,
      });
      await openExternal(result.url);
    }, "");
  return (
    <section
      className="project-pro-results"
      aria-labelledby="project-pro-title"
    >
      <div className="project-pro-results-heading">
        <Users size={25} />
        <div>
          <h2 id="project-pro-title">
            {ids.length} {ids.length === 1 ? "professional" : "professionals"}{" "}
            for this project
          </h2>
          <p>Compare profiles and estimates to choose the best fit.</p>
        </div>
      </div>
      <div id="project-professionals" className="project-pro-list">
        {!ids.length && (
          <p>
            No professionals yet. New matches and estimates will appear here.
          </p>
        )}
        {ordered.map((proId) => {
          const profile = profiles.find((f) => f.id === proId);
          const estimates = quotes.filter((q) => q.proId === proId);
          const assigned = p.proId === proId;
          const business =
            profile?.business ||
            (assigned ? p.proName : null) ||
            "Professional";
          const image =
            profile?.images?.find((i) => i.slot === "cover") ||
            profile?.images?.find((i) => i.slot === "logo");
          const matched = profile?.matchedProjectIds?.includes(p.id);
          const canContact =
            assigned ||
            estimates.some((q) => ["pending", "accepted"].includes(q.status)) ||
            (open &&
              !p.proId &&
              !!profile &&
              !profile.suspended &&
              (!data.marketplacePreview || profile.canRespond) &&
              (matched || profile.discoverable));
          const calling =
            assigned && ["booked", "in_progress", "paused"].includes(p.status);
          return (
            <article
              className={"project-pro-card" + (assigned ? " selected" : "")}
              key={proId}
            >
              <div
                className={
                  "project-pro-media" +
                  (image?.slot === "logo" ? " logo-only" : "")
                }
              >
                {image ? (
                  <img
                    src={image.url}
                    alt={business + " business image"}
                    loading="lazy"
                  />
                ) : (
                  <div className="project-pro-placeholder">
                    <ServiceIcon
                      service={profile?.category || p.category}
                      size={52}
                    />
                    <span>{profile?.category || p.category}</span>
                  </div>
                )}
                {profile && <SavePro proId={proId} />}
                {(assigned || matched) && (
                  <span className="project-pro-match">
                    {assigned ? "Selected professional" : "Project match"}
                  </span>
                )}
                {!!profile?.images?.length && (
                  <span className="project-pro-photo-count">
                    <Image size={13} />
                    {profile.images.length}{" "}
                    {profile.images.length === 1 ? "photo" : "photos"}
                  </span>
                )}
              </div>
              <div className="project-pro-main">
                <h3>
                  {business}
                  {profile?.verified && (
                    <ShieldCheck size={17} aria-label="Identity verified" />
                  )}
                </h3>
                <span className="project-pro-relationship">
                  {assigned
                    ? "Selected professional"
                    : estimates.length
                      ? "Estimate received"
                      : matched
                        ? "Matched to your request"
                        : "Available to contact"}
                </span>
                {profile && (
                  <>
                    <div className="project-pro-meta">
                      {profile.reviewCount > 0 ? (
                        <span className="project-pro-rating">
                          <Star size={16} />
                          <strong>{profile.rating.toFixed(1)}</strong> (
                          {profile.reviewCount} reviews)
                        </span>
                      ) : (
                        <span>No reviews yet</span>
                      )}
                      {profile.verified && (
                        <span>
                          <ShieldCheck size={14} />
                          Identity verified
                        </span>
                      )}
                      {profile.details?.yearsExperience !== undefined && (
                        <span>
                          <BriefcaseBusiness size={14} />
                          {profile.details.yearsExperience} years experience
                        </span>
                      )}
                    </div>
                    <div className="professional-card-services">
                      {profile.serviceCategories.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </div>
                    <p className="project-pro-bio">{profile.bio}</p>
                    <p className="project-pro-location">
                      <MapPin size={14} />
                      {[profile.details?.city, profile.details?.state]
                        .filter(Boolean)
                        .join(", ") || profile.zip}{" "}
                      · Serves within {profile.serviceRadiusMiles} miles
                    </p>
                  </>
                )}
              </div>
              <aside
                className="project-pro-offer"
                aria-label={business + " actions and estimates"}
              >
                <div className="actions project-pro-actions">
                  {canContact && (
                    <ChatWithPro projectId={p.id} proId={proId} label="Chat" />
                  )}
                  {profile && (
                    <button onClick={() => go("pro", proId)}>
                      View profile
                    </button>
                  )}
                  {calling && (
                    <>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => call(true)}
                      >
                        <Phone size={16} />
                        Audio
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => call(false)}
                      >
                        <Video size={16} />
                        Video
                      </button>
                    </>
                  )}
                </div>
                {estimates.map((q) => (
                  <section
                    className="project-pro-estimate"
                    key={q.id}
                    aria-label={business + " estimate"}
                  >
                    <div className="project-pro-price">
                      <strong>{money(q.amount)}</strong>
                      <Badge>
                        {q.status === "pending" &&
                        q.expiresAt &&
                        Date.parse(q.expiresAt) <= Date.now()
                          ? "expired"
                          : q.status === "pending" && !open
                            ? "on hold"
                            : q.status}
                      </Badge>
                    </div>
                    <p className="project-pro-timeline">
                      <CalendarDays size={15} />
                      {q.timeline}
                    </p>
                    <details>
                      <summary>Estimate details · version {q.revision}</summary>
                      <p>{q.description}</p>
                      <dl>
                        <dt>Labor</dt>
                        <dd>{money(q.laborAmount)}</dd>
                        <dt>Materials</dt>
                        <dd>{money(q.materialsAmount)}</dd>
                        <dt>Exclusions</dt>
                        <dd>{q.exclusions || "None listed"}</dd>
                        <dt>Valid until</dt>
                        <dd>
                          {q.expiresAt
                            ? new Date(q.expiresAt).toLocaleString()
                            : "No expiration"}
                        </dd>
                      </dl>
                    </details>
                    {open && q.status === "pending" && (
                      <div className="actions">
                        {estimateCanBeAccepted(p, q) && (
                          <button
                            disabled={busy}
                            onClick={() => accept(q, business)}
                          >
                            Accept estimate
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => submit({ type: "decline", quoteId: q.id }),
                              "Estimate declined.",
                            )
                          }
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </section>
                ))}
                {!estimates.length && (
                  <p className="project-pro-waiting">
                    {profile && profile.rate > 0 && (
                      <strong>
                        {money(Math.round(profile.rate * 100))}/hr starting
                        rate.{" "}
                      </strong>
                    )}
                    {assigned
                      ? "No estimate recorded."
                      : canContact
                        ? "No estimate yet. Chat to discuss this request."
                        : "Not accepting new requests yet."}
                  </p>
                )}
              </aside>
            </article>
          );
        })}
      </div>
    </section>
  );
}
