import { useState } from "react";
import {
  BadgeCheck,
  CircleSlash,
  Lock,
  MessageSquareReply,
  PenLine,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { closedProject, type Project, type Review } from "../shared/domain.js";
import { reviewerDisplayName } from "../shared/reviews.js";
import { request } from "./api.js";
import { ProjectDialog } from "./project-dialog.js";
import { ReviewPhotoEditor } from "./review-photos.js";
import {
  RatingPicker,
  ReviewCard,
  ReviewRules,
  ReviewSummary,
  Stars,
  ratingLabels,
} from "./reviews.js";
import { Empty, Field, Head } from "./ui.js";
import { useWorkspace } from "./workspace.js";

type Draft = { rating: number; body: string; showName: boolean };
// Unfinished reviews survive closing the dialog, but never leave this tab.
const drafts = new Map<string, Draft>();

function useReviewDetails() {
  const { data } = useWorkspace();
  const project = (id: string) =>
    [...data.projects, ...data.leads].find((p) => p.id === id);
  const business = (p?: Project) =>
    data.profiles.find((x) => x.id === p?.proId)?.business ||
    p?.proName ||
    "this professional";
  const town = (p?: Project) =>
    [p?.town, p?.region].filter(Boolean).join(", ") || null;
  // The same fields the public profile shows for this review.
  const published = (r: Review) => {
    const p = project(r.projectId);
    return {
      ...r,
      reviewer: r.reviewerName ?? null,
      town: r.reviewerName ? town(p) : null,
      category: p?.category,
      completedProject: true,
    };
  };
  return { project, business, town, published };
}

function BusinessMark({ proId }: { proId: string | null }) {
  const { data } = useWorkspace();
  const profile = data.profiles.find((x) => x.id === proId);
  const logo = profile?.images?.find((i) => i.slot === "logo");
  return (
    <span className="review-business-mark" aria-hidden="true">
      {logo ? (
        <img src={logo.url} alt="" loading="lazy" />
      ) : (
        (profile?.business || "A")[0]
      )}
    </span>
  );
}

// One tap on a star opens the review with that rating already chosen.
function QuickRating({ project: p }: { project: Project }) {
  const { go } = useWorkspace();
  return (
    <div className="review-quick-rating" role="group" aria-label="Rate now">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="icon-button"
          title={ratingLabels[n]}
          aria-label={`${n} / 5 — ${ratingLabels[n]}`}
          onClick={() => {
            const draft = drafts.get(p.id);
            drafts.set(p.id, {
              body: "",
              showName: true,
              ...draft,
              rating: n,
            });
            go("reviews", p.id);
          }}
        >
          <Star size={26} />
        </button>
      ))}
    </div>
  );
}

function ReviewComposer({
  project: p,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { data, run, busy } = useWorkspace();
  const details = useReviewDetails();
  const publicName = reviewerDisplayName(data.user.name);
  const [draft, setDraft] = useState<Draft>(
    () => drafts.get(p.id) || { rating: 0, body: "", showName: true },
  );
  const [step, setStep] = useState<"write" | "preview">("write");
  const [photosBusy, setPhotosBusy] = useState(false);
  const update = (change: Partial<Draft>) => {
    const next = { ...draft, ...change };
    drafts.set(p.id, next);
    setDraft(next);
  };
  const business = details.business(p);
  const town = details.town(p);
  const named = draft.showName && !!publicName;
  const signature = named ? [publicName, town].filter(Boolean).join(" · ") : "";
  return (
    <ProjectDialog
      title={`Review ${business}`}
      busy={busy || photosBusy}
      onClose={onClose}
    >
      <div className="review-composer">
        <header className="review-composer-subject">
          <BusinessMark proId={p.proId} />
          <div>
            <strong>{business}</strong>
            <small>
              {p.title} · {p.category}
            </small>
          </div>
          <ol className="review-steps" aria-label="Steps">
            <li aria-current={step === "write" ? "step" : undefined}>Write</li>
            <li aria-current={step === "preview" ? "step" : undefined}>
              Preview and publish
            </li>
          </ol>
        </header>
        {step === "write" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("preview");
            }}
          >
            <fieldset disabled={busy || photosBusy}>
              <RatingPicker
                value={draft.rating}
                onChange={(rating) => update({ rating })}
              />
              <Field label="Tell others about your experience">
                <textarea
                  name="body"
                  maxLength={2000}
                  rows={6}
                  required
                  value={draft.body}
                  onChange={(e) => update({ body: e.target.value })}
                  aria-describedby="review-writing-help"
                />
              </Field>
              <div className="review-writing-help" id="review-writing-help">
                <ul>
                  <li>What work was done, and how did it turn out?</li>
                  <li>How were communication and timing?</li>
                  <li>Would you hire them again?</li>
                </ul>
                <span>{draft.body.length}/2000</span>
              </div>
              <p className="review-privacy-note">
                Keep addresses, phone numbers and other private information out
                of your review.
              </p>
              <ReviewPhotoEditor
                projectId={p.id}
                editable
                onBusy={setPhotosBusy}
              />
              {publicName ? (
                <fieldset className="review-name-choice">
                  <legend>How should your review be signed?</legend>
                  <label>
                    <input
                      type="radio"
                      name="signature"
                      checked={draft.showName}
                      onChange={() => update({ showName: true })}
                    />
                    <span>
                      <strong>
                        {[publicName, town].filter(Boolean).join(" · ")}
                      </strong>
                      <small>
                        Your first name, last initial
                        {town ? " and the project’s town" : ""}.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="signature"
                      checked={!draft.showName}
                      onChange={() => update({ showName: false })}
                    />
                    <span>
                      <strong>Aplime customer</strong>
                      <small>No name or town is shown.</small>
                    </span>
                  </label>
                  <p className="muted">
                    Your full name, address and contact details are never shown
                    with a review.
                  </p>
                </fieldset>
              ) : (
                <p className="muted">
                  Your review will be signed “Aplime customer”. Your name,
                  address and contact details are never shown.
                </p>
              )}
              <div className="actions">
                <button disabled={!draft.rating || !draft.body.trim()}>
                  Preview review
                </button>
                <button type="button" className="text-button" onClick={onClose}>
                  Finish later
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <div className="review-preview">
            <p>
              This is how your review will appear on {business}’s public
              profile.
            </p>
            <ReviewCard
              review={{
                rating: draft.rating,
                body: draft.body.trim(),
                reply: null,
                createdAt: new Date().toISOString(),
                category: p.category,
                completedProject: true,
                reviewer: named ? publicName : null,
                town: named ? town : null,
              }}
            >
              <ReviewPhotoEditor projectId={p.id} />
            </ReviewCard>
            <p className="review-submit-notice">
              <Lock size={16} /> Reviews are final. After publishing, your
              rating, text, photos and
              {signature ? ` signature (${signature})` : " signature"} can’t be
              edited or removed.
            </p>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      await request("/projects/" + p.id + "/review", {
                        rating: draft.rating,
                        body: draft.body.trim(),
                        showName: named,
                      });
                      drafts.delete(p.id);
                    },
                    "Review published.",
                    onClose,
                  )
                }
              >
                Publish review
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setStep("write")}
              >
                Back to edit
              </button>
            </div>
          </div>
        )}
      </div>
    </ProjectDialog>
  );
}

function CustomerReviews() {
  const { data, id, go } = useWorkspace();
  const details = useReviewDetails();
  const ready = data.projects.filter(
    (p) =>
      p.status === "completed" &&
      !!p.proId &&
      p.customerId === data.user.id &&
      !data.reviews.some((r) => r.projectId === p.id),
  );
  const writing = ready.find((p) => p.id === id);
  return (
    <>
      <Head title="Reviews">
        Share how your completed projects went. Honest reviews help other
        customers choose with confidence.
      </Head>
      {!!ready.length && (
        <section className="review-section" aria-labelledby="review-ready">
          <h2 id="review-ready">
            Ready for your review <span>{ready.length}</span>
          </h2>
          <div className="review-invites">
            {ready.map((p) => (
              <article className="review-invite" key={p.id}>
                <BusinessMark proId={p.proId} />
                <div className="review-invite-copy">
                  <strong>{details.business(p)}</strong>
                  <small>
                    {p.title} · {p.category}
                  </small>
                  <span className="review-verified">
                    <BadgeCheck size={15} /> Completed project
                  </span>
                </div>
                <div className="review-invite-actions">
                  <QuickRating project={p} />
                  <button onClick={() => go("reviews", p.id)}>
                    <PenLine size={17} />{" "}
                    {drafts.has(p.id)
                      ? "Continue your review"
                      : "Write a review"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="review-section" aria-labelledby="review-published">
        <h2 id="review-published">
          Your reviews{" "}
          {!!data.reviews.length && <span>{data.reviews.length}</span>}
        </h2>
        {data.reviews.length ? (
          <div className="review-list">
            {data.reviews.map((r) => {
              const p = details.project(r.projectId);
              return (
                <ReviewCard
                  key={r.id}
                  review={details.published(r)}
                  context={
                    p ? `${p.title} · ${details.business(p)}` : undefined
                  }
                  business={details.business(p)}
                >
                  <ReviewPhotoEditor projectId={r.projectId} />
                  <p className="review-final-note">
                    <Lock size={14} /> Published — your rating, text and photos
                    are final.
                  </p>
                </ReviewCard>
              );
            })}
          </div>
        ) : (
          <Empty title="No reviews yet.">
            {ready.length
              ? "Your published reviews will appear here."
              : "You can review a professional here after your project with them is completed."}
          </Empty>
        )}
      </section>
      <ReviewRules />
      {writing && (
        <ReviewComposer
          key={writing.id}
          project={writing}
          onClose={() => go("reviews")}
        />
      )}
    </>
  );
}

function ResponseComposer({ review }: { review: Review }) {
  const { run, busy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button
        className="secondary review-respond"
        onClick={() => setOpen(true)}
      >
        <MessageSquareReply size={17} /> Respond publicly
      </button>
    );
  return (
    <form
      className="review-response-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !window.confirm(
            "Publish this response? It can’t be edited or removed afterwards.",
          )
        )
          return;
        void run(
          () =>
            request("/reviews/" + review.id + "/reply", {
              reply: text.trim(),
            }),
          "Response published.",
        );
      }}
    >
      <fieldset disabled={busy}>
        <Field label="Your public response">
          <textarea
            name="reply"
            maxLength={1500}
            rows={4}
            required
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="review-writing-help">
          <ul>
            <li>Thank the customer and respond to what they wrote.</li>
            <li>Stay professional, and leave out private details.</li>
          </ul>
          <span>{text.length}/1500</span>
        </div>
        <p className="review-submit-notice">
          <Lock size={16} /> You can post one response per review. It appears
          publicly under the review and can’t be edited or removed afterwards.
        </p>
        <div className="actions">
          <button disabled={!text.trim()}>Publish response</button>
          <button
            type="button"
            className="text-button"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function ProfessionalReviews() {
  const { data, go } = useWorkspace();
  const details = useReviewDetails();
  const [filter, setFilter] = useState<"all" | "waiting">("all");
  const reviews = data.reviews.filter((r) => r.proId === data.user.id);
  const waiting = reviews.filter((r) => !r.reply);
  const total = reviews.length;
  const profile = data.profiles.find((x) => x.id === data.user.id);
  return (
    <>
      <Head
        title="Reviews"
        action={
          profile?.listed && (
            <button
              className="secondary"
              onClick={() => go("pro", data.user.id)}
            >
              <UserRound size={17} /> View public profile
            </button>
          )
        }
      >
        What customers say after completing a project with you on Aplime.
      </Head>
      {total ? (
        <>
          <ReviewSummary
            total={total}
            average={reviews.reduce((sum, r) => sum + r.rating, 0) / total}
            distribution={[1, 2, 3, 4, 5].map(
              (n) => reviews.filter((r) => r.rating === n).length,
            )}
          />
          <div className="review-filter" role="group" aria-label="Show">
            <button
              className={filter === "all" ? "" : "secondary"}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All reviews <span>{total}</span>
            </button>
            <button
              className={filter === "waiting" ? "" : "secondary"}
              aria-pressed={filter === "waiting"}
              onClick={() => setFilter("waiting")}
            >
              Awaiting your response <span>{waiting.length}</span>
            </button>
          </div>
          <div className="review-list">
            {(filter === "all" ? reviews : waiting).map((r) => (
              <ReviewCard
                key={r.id}
                review={details.published(r)}
                context={details.project(r.projectId)?.title}
                business={profile?.business}
              >
                <ReviewPhotoEditor projectId={r.projectId} />
                {!r.reply && <ResponseComposer review={r} />}
              </ReviewCard>
            ))}
            {filter === "waiting" && !waiting.length && (
              <p className="review-none">You’ve responded to every review.</p>
            )}
          </div>
        </>
      ) : (
        <Empty title="No reviews yet.">
          Customers can review you after a project with you is completed on
          Aplime. Reviews then appear here and on your public profile.
        </Empty>
      )}
      <ReviewRules />
      <p className="muted review-report">
        Does a review share private information or break the rules?{" "}
        <button className="text-button" onClick={() => go("help")}>
          Contact support
        </button>
      </p>
    </>
  );
}

export function ReviewsPage() {
  const { data } = useWorkspace();
  return data.user.role === "pro" ? (
    <ProfessionalReviews />
  ) : (
    <CustomerReviews />
  );
}

// Shown on a finished or cancelled project in place of the editing tools.
export function ProjectOutcome({ project: p }: { project: Project }) {
  const { data, go } = useWorkspace();
  const details = useReviewDetails();
  const customer = p.customerId === data.user.id;
  if (!closedProject(p.status) || (!customer && p.proId !== data.user.id))
    return null;
  if (p.status === "cancelled")
    return (
      <section className="project-outcome cancelled">
        <CircleSlash size={26} aria-hidden="true" />
        <div>
          <h2>Project cancelled</h2>
          <p>
            This project is closed and its details can no longer be edited. Your
            messages and records stay available.
          </p>
        </div>
      </section>
    );
  const review = data.reviews.find((r) => r.projectId === p.id);
  return (
    <section className="project-outcome completed">
      <Trophy size={26} aria-hidden="true" />
      <div>
        <h2>Project completed</h2>
        <p>
          {customer
            ? review
              ? `Thank you for reviewing ${details.business(p)}.`
              : p.proId
                ? `How did it go with ${details.business(p)}? Your review helps other customers choose.`
                : ""
            : review
              ? "The customer reviewed this project."
              : "The customer can now leave a review. You’ll be notified when they do."}{" "}
          The project details are final and can no longer be edited.
        </p>
      </div>
      {review ? (
        <div className="project-outcome-actions">
          <Stars value={review.rating} size={20} />
          <button className="secondary" onClick={() => go("reviews")}>
            {customer
              ? "View your review"
              : review.reply
                ? "View review"
                : "Read and respond"}
          </button>
        </div>
      ) : (
        customer &&
        p.proId && (
          <div className="project-outcome-actions">
            <QuickRating project={p} />
            <button onClick={() => go("reviews", p.id)}>
              <PenLine size={17} /> Leave a review
            </button>
          </div>
        )
      )}
    </section>
  );
}
