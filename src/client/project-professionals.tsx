import { useState } from "react";
import { ProjectDialog } from "./project-dialog.js";
import { T } from "../shared/language.js";
import { quotePrice, quoteTiming } from "../shared/estimates.js";
import { ProfessionalCard } from "./marketplace-cards.js";
import { ProfessionalActions } from "./professional-actions.js";
import { CalendarDays, Clock, ReceiptText, Send, Users } from "lucide-react";
import { closedProject, type Project, type Quote } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { Badge } from "./ui.js";
import { ChatWithPro, SavePro } from "./project-actions.js";
import { projectProfessionals, estimateCanBeAccepted } from "./project-hub.js";
const day = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
// One estimate in full, with whatever the customer can still do about it.
function EstimateSheet({
  project: p,
  quote: q,
  business,
  canContact,
  submit,
  onDone,
}: {
  project: Project;
  quote: Quote;
  business: string;
  canContact: boolean;
  submit: (body: unknown) => Promise<unknown>;
  onDone: () => void;
}) {
  const { run, busy } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const open = ["requested", "quoted"].includes(p.status);
  const pending = q.status === "pending";
  const expired =
    pending && !!q.expiresAt && Date.parse(q.expiresAt) <= Date.now();
  const acceptable = estimateCanBeAccepted(p, q);
  const state = expired ? "expired" : pending && !open ? "on hold" : q.status;
  const note = expired
    ? `This estimate has expired. Ask ${business} for an updated one.`
    : pending && !open
      ? "On hold. Estimates can only be accepted while the project is still collecting them."
      : acceptable
        ? `Accepting asks ${business} to confirm the job. Your other estimates stay on hold until they do.`
        : pending
          ? `${business} needs to assess the job before giving a price, so there is nothing to accept yet. They can send a priced estimate afterwards.`
          : q.status === "accepted"
            ? "You selected this estimate."
            : q.status === "declined"
              ? "This estimate was declined."
              : q.status === "withdrawn"
                ? "This estimate was withdrawn."
                : "";
  return (
    <article
      className={"estimate-sheet estimate-" + state.replace(" ", "-")}
      aria-label={`${business} estimate, version ${q.revision}`}
    >
      <header>
        <div>
          <small>Estimate · version {q.revision}</small>
          <strong>{quotePrice(q)}</strong>
        </div>
        <Badge>{state}</Badge>
      </header>
      <ul className="estimate-sheet-facts">
        <li>
          <CalendarDays size={16} />
          {quoteTiming(q)}
        </li>
        <li>
          <Clock size={16} />
          {q.expiresAt ? (
            <>
              {expired ? "Expired" : <T>{"Valid until"}</T>}{" "}
              {new Date(q.expiresAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </>
          ) : (
            "No expiration"
          )}
        </li>
        <li>
          <Send size={16} />
          Sent {day(q.createdAt)}
        </li>
      </ul>
      <dl>
        <dt>What’s included</dt>
        <dd>{q.description}</dd>
        {q.exclusions && (
          <>
            <dt>
              <T>{"Exclusions"}</T>
            </dt>
            <dd>{q.exclusions}</dd>
          </>
        )}
      </dl>
      {note && <p className="estimate-sheet-note">{note}</p>}
      {confirming ? (
        <div className="estimate-sheet-confirm" role="group">
          <p>
            Accept {quotePrice(q)} from {business}?
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    submit({
                      type: "accept",
                      quoteId: q.id,
                      revision: q.revision,
                    }),
                  "Estimate selected. The professional must confirm the job before work starts.",
                  onDone,
                )
              }
            >
              Yes, accept estimate
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {acceptable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <T>{"Accept estimate"}</T>
            </button>
          )}
          {open && pending && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => submit({ type: "decline", quoteId: q.id }),
                  "Estimate declined.",
                  onDone,
                )
              }
            >
              <T>{"Decline"}</T>
            </button>
          )}
          {canContact && (
            <ChatWithPro projectId={p.id} proId={q.proId} label="Chat" />
          )}
        </div>
      )}
    </article>
  );
}
export function ProjectProfessionals({
  project: p,
  submit,
}: {
  project: Project;
  submit: (body: unknown) => Promise<unknown>;
}) {
  const { data, busy } = useWorkspace();
  const [estimatePro, setEstimatePro] = useState<string | null>(null);
  const quotes = data.quotes.filter((q) => q.projectId === p.id);
  const profiles = projectProfessionals(p, data.profiles, quotes, false);
  // Retain estimate records even if a professional's profile is no longer available.
  const ids = [
    ...new Set([
      ...profiles.map((f) => f.id),
      ...quotes.map((q) => q.proId),
      ...(p.proId ? [p.proId] : []),
    ]),
  ];
  const open = ["requested", "quoted"].includes(p.status);
  const pros = [...ids]
    .sort((a, b) => Number(b === p.proId) - Number(a === p.proId))
    .map((proId) => {
      const profile = profiles.find((f) => f.id === proId);
      const estimates = quotes
        .filter((q) => q.proId === proId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const assigned = p.proId === proId;
      const matched = profile?.matchedProjectIds?.includes(p.id);
      return {
        proId,
        profile,
        estimates,
        assigned,
        business:
          profile?.business || (assigned ? p.proName : null) || "Professional",
        canContact:
          assigned ||
          estimates.some((q) => ["pending", "accepted"].includes(q.status)) ||
          !!(
            open &&
            !p.proId &&
            profile &&
            !profile.suspended &&
            (!data.marketplacePreview || profile.canRespond) &&
            (matched || profile.discoverable)
          ),
      };
    });
  const estimatesContent = (pro: (typeof pros)[number]) => (
    <>
      {pro.estimates.map((q) => (
        <EstimateSheet
          key={q.id}
          project={p}
          quote={q}
          business={pro.business}
          canContact={pro.canContact}
          submit={submit}
          onDone={() => setEstimatePro(null)}
        />
      ))}
      {!pro.estimates.length && (
        <div className="estimate-sheet-empty">
          <p>
            {pro.assigned
              ? "No estimate recorded."
              : !pro.canContact
                ? "Not accepting new requests yet."
                : open
                  ? `${pro.business} has not sent an estimate yet. Chat to discuss this request.`
                  : "No estimate was sent for this project."}
          </p>
          {pro.canContact && (
            <ChatWithPro projectId={p.id} proId={pro.proId} label="Chat" />
          )}
        </div>
      )}
    </>
  );
  const viewing = pros.find((pro) => pro.proId === estimatePro);
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
        </div>
      </div>
      <div id="project-professionals" className="pro-grid">
        {!ids.length && (
          <p>
            {closedProject(p.status)
              ? "No professionals were involved in this project."
              : "No matching professionals yet. New matches and estimates will appear here."}
          </p>
        )}
        {pros.map((pro) => {
          const { proId, profile, estimates } = pro;
          const awaiting = estimates.some((q) => estimateCanBeAccepted(p, q));
          return profile ? (
            <ProfessionalCard
              key={proId}
              profile={profile}
              layout="horizontal"
              compact
              preview={data.marketplacePreview && !profile.canRespond}
              save={<SavePro proId={proId} />}
              actions={
                <>
                  {(estimates.length > 0 || open) && (
                    <button
                      type="button"
                      className={
                        "secondary estimate-button" +
                        (awaiting ? " awaiting" : "")
                      }
                      onClick={() => setEstimatePro(proId)}
                    >
                      <ReceiptText size={17} />
                      {estimates.length > 1
                        ? `View estimates (${estimates.length})`
                        : estimates.length
                          ? "View estimate"
                          : "Estimate"}
                      {awaiting && (
                        <span className="sr-only">
                          , waiting for your decision
                        </span>
                      )}
                    </button>
                  )}
                  <ProfessionalActions
                    proId={proId}
                    projectId={p.id}
                    canContact={pro.canContact}
                  />
                </>
              }
            >
              {pro.assigned && <small>Selected professional</small>}
            </ProfessionalCard>
          ) : (
            <article
              className="professional-card unavailable-profile"
              key={proId}
            >
              <div className="professional-card-body">
                <h2>{pro.business}</h2>
                <p>
                  This business profile is no longer available. Its estimates
                  are retained below.
                </p>
                {estimatesContent(pro)}
              </div>
            </article>
          );
        })}
      </div>
      {viewing && (
        <ProjectDialog
          title={
            viewing.business +
            (viewing.estimates.length > 1 ? " · estimates" : " · estimate")
          }
          busy={busy}
          onClose={() => setEstimatePro(null)}
        >
          {estimatesContent(viewing)}
        </ProjectDialog>
      )}
    </section>
  );
}
