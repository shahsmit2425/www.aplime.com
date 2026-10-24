import { quotePrice, quoteTiming } from "../shared/estimates.js";
import { ProfessionalCard } from "./marketplace-cards.js";
import { ProfessionalActions } from "./professional-actions.js";
import { CalendarDays, Users } from "lucide-react";
import { responseLabels, type Project, type Quote } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { Badge } from "./ui.js";
import { SavePro } from "./project-actions.js";
import { projectProfessionals, estimateCanBeAccepted } from "./project-hub.js";
export function ProjectProfessionals({
  project: p,
  submit,
}: {
  project: Project;
  submit: (body: unknown) => Promise<unknown>;
}) {
  const { data, run, busy } = useWorkspace();
  const quotes = data.quotes.filter((q) => q.projectId === p.id);
  const responses = (data.projectResponses || []).filter(
    (r) => r.projectId === p.id,
  );
  const profiles = projectProfessionals(
    p,
    data.profiles,
    quotes,
    data.discoveryMode === "open",
  );
  for (const response of responses) {
    const profile = data.profiles.find((f) => f.id === response.proId);
    if (profile && !profiles.some((f) => f.id === profile.id))
      profiles.push(profile);
  }
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
        `Accept ${quotePrice(q)} from ${business}? This professional must confirm the job. Your other estimates stay on hold until they do.`,
      )
    )
      return;
    void run(
      () => submit({ type: "accept", quoteId: q.id, revision: q.revision }),
      "Estimate selected. The professional must confirm the job before work starts.",
    );
  };
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
          <p>
            Compare profiles and estimates. Matching professionals may respond
            here; a call is optional.
          </p>
        </div>
      </div>
      <div id="project-professionals" className="pro-grid">
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
          const response = responses.find((r) => r.proId === proId);
          const matched = profile?.matchedProjectIds?.includes(p.id);
          const canContact =
            assigned ||
            (!!response &&
              response.status !== "unavailable" &&
              !!profile &&
              !profile.suspended) ||
            estimates.some((q) => ["pending", "accepted"].includes(q.status)) ||
            (open &&
              !p.proId &&
              !!profile &&
              !profile.suspended &&
              (!data.marketplacePreview || profile.canRespond) &&
              (matched || profile.discoverable));
          const estimatesContent = (
            <>
              {estimates.map((q) => (
                <section
                  className="project-pro-estimate"
                  key={q.id}
                  aria-label={business + " estimate"}
                >
                  <div className="project-pro-price">
                    <strong>{quotePrice(q)}</strong>
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
                    {quoteTiming(q)}
                  </p>
                  <details>
                    <summary>Estimate details · version {q.revision}</summary>
                    <p>{q.description}</p>
                    <dl>
                      {q.exclusions && (
                        <>
                          <dt>Exclusions</dt>
                          <dd>{q.exclusions}</dd>
                        </>
                      )}
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
                  {assigned
                    ? "No estimate recorded."
                    : canContact
                      ? "No estimate yet. Chat to discuss this request."
                      : "Not accepting new requests yet."}
                </p>
              )}
            </>
          );
          return profile ? (
            <ProfessionalCard
              key={proId}
              profile={profile}
              layout="horizontal"
              preview={data.marketplacePreview && !profile.canRespond}
              save={<SavePro proId={proId} />}
              actions={
                <ProfessionalActions
                  proId={proId}
                  projectId={p.id}
                  canContact={canContact}
                />
              }
            >
              {(assigned || matched) && (
                <p className="professional-relationship">
                  {assigned
                    ? "Selected professional"
                    : `${p.category} · Covers your project area`}
                </p>
              )}
              {response && (
                <p className="professional-relationship">
                  <Badge>{responseLabels[response.status]}</Badge>
                </p>
              )}
              {estimatesContent}
            </ProfessionalCard>
          ) : (
            <article
              className="professional-card unavailable-profile"
              key={proId}
            >
              <div className="professional-card-body">
                <h2>{business}</h2>
                <p>
                  This business profile is no longer available. Its estimates
                  are retained below.
                </p>
                {estimatesContent}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
