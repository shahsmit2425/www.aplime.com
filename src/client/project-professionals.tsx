import {
  CalendarDays,
  MapPin,
  Phone,
  Video,
  ShieldCheck,
  Star,
} from "lucide-react";
import { money, type Project, type Quote } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { Panel, ServiceIcon, Badge } from "./ui.js";
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
    <Panel title="Professionals for this project">
      <div id="project-professionals" className="project-pro-list">
        {!ids.length && (
          <p>
            No professionals yet. New matches and estimates will appear here.
          </p>
        )}
        {ids.map((proId) => {
          const profile = profiles.find((f) => f.id === proId);
          const estimates = quotes.filter((q) => q.proId === proId);
          const assigned = p.proId === proId;
          const business =
            profile?.business ||
            (assigned ? p.proName : null) ||
            "Professional";
          const image =
            profile?.images?.find((i) => i.slot === "logo") ||
            profile?.images?.find((i) => i.slot === "cover");
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
              <div className="project-pro-heading">
                <div className="project-pro-image">
                  {image ? (
                    <img
                      src={image.url}
                      alt={business + " business image"}
                      loading="lazy"
                    />
                  ) : (
                    <ServiceIcon
                      service={profile?.category || p.category}
                      size={30}
                    />
                  )}
                </div>
                <div>
                  <h3>{business}</h3>
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
                    <div className="project-pro-meta">
                      {profile.verified && (
                        <span>
                          <ShieldCheck size={14} />
                          Identity verified
                        </span>
                      )}
                      {profile.reviewCount > 0 ? (
                        <span>
                          <Star size={14} />
                          {profile.rating.toFixed(1)} ({profile.reviewCount}{" "}
                          reviews)
                        </span>
                      ) : (
                        <span>No reviews yet</span>
                      )}
                    </div>
                  )}
                </div>
                {profile && <SavePro proId={proId} />}
              </div>
              {profile && (
                <>
                  <div className="professional-card-services">
                    {profile.serviceCategories.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                  <p className="project-pro-bio">{profile.bio}</p>
                  <p className="project-pro-location">
                    <MapPin size={14} />
                    {profile.zip} · Serves within {profile.serviceRadiusMiles}{" "}
                    miles
                  </p>
                </>
              )}
              <div className="actions project-pro-actions">
                {canContact && (
                  <ChatWithPro projectId={p.id} proId={proId} label="Chat" />
                )}
                {profile && (
                  <button
                    className="secondary"
                    onClick={() => go("pro", proId)}
                  >
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
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
