import { CONTACT_CONSENT } from "../shared/project-contact.js";
import { T, useT } from "../shared/language.js";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  categories,
  money,
  projectSchema,
  type Workspace,
} from "../shared/domain.js";
import { type ServiceCategory } from "../shared/service-questionnaires.js";
import { AddressAutocomplete } from "./address-autocomplete.js";
import {
  ProjectPhotos,
  useProjectPhotos,
  publishProjectPhotos,
} from "./project-photos.js";
import { Field, ServiceIcon } from "./ui.js";
import { request } from "./api.js";
import { saveIntakePhotos, loadIntakePhotos } from "./intake-photo-storage.js";
import {
  INTAKE_KEY,
  INTAKE_RESUME,
  initialIntake,
  freshIntakeSession,
  parseIntakeSession,
  intakeQuestions,
  intakeSteps,
  intakeBudgetChoice,
  projectPayload,
  firstInvalidStep,
  stepProblem,
  type IntakeSession,
  type IntakeDraft,
} from "./project-intake-state.js";

type Props = {
  data?: Workspace | null;
  draftMode?: boolean;
  proId?: string;
  onAuthenticate: () => void;
  onPublished: (id: string) => Promise<void>;
};
function startingSession({ data, draftMode, proId }: Props): IntakeSession {
  let stored: IntakeSession | null = null;
  try {
    stored = parseIntakeSession(
      sessionStorage.getItem(INTAKE_KEY),
      data?.user.id || null,
    );
  } catch {}
  const saved = draftMode ? data?.projectDraft : undefined;
  if (stored && (!saved || stored.draftUpdatedAt === saved.updatedAt))
    return { ...stored, owner: data?.user.id || stored.owner };
  const query = new URLSearchParams(window.location.search);
  const pro = data?.profiles.find((p) => p.id === proId);
  const category = pro?.category || query.get("category");
  const draft = initialIntake(
    saved?.payload || {
      category: categories.includes(category as ServiceCategory)
        ? category
        : categories[0],
      proId: pro?.id || null,
    },
  );
  if (saved && !draft.zip)
    draft.zip = draft.address.match(/\bNJ\s+(\d{5})\b/)?.[1] || "";
  if (!saved)
    draft.zip = /^\d{5}$/.test(query.get("zip") || "") ? query.get("zip")! : "";
  return {
    version: 1,
    updatedAt: Date.now(),
    owner: data?.user.id || null,
    draft,
    step: "zip",
    photoKey: crypto.randomUUID(),
    clientKey: crypto.randomUUID(),
    signature: "",
    savedProjectId: null,
    draftUpdatedAt: saved?.updatedAt,
    photoCount: 0,
  };
}
function Choices({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="intake-choices" role="group" aria-label="Choose an answer">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={value === option}
          className={
            value === option ? "intake-choice selected" : "intake-choice"
          }
          onClick={() => onChange(option)}
        >
          <span>
            <T>{option}</T>
          </span>
          <span className="choice-check" aria-hidden="true">
            {value === option && <Check size={18} />}
          </span>
        </button>
      ))}
    </div>
  );
}
const textOptions: Record<string, string[]> = {
  rooms: [
    "1 bedroom, 1 bathroom",
    "2 bedrooms, 1 bathroom",
    "2 bedrooms, 2 bathrooms",
    "3 bedrooms, 2 bathrooms",
    "4+ bedrooms, 3+ bathrooms",
  ],
  affectedArea: ["Kitchen", "Bathroom", "Laundry room", "Basement", "Outside"],
  panel: ["Not sure — I need advice"],
  size: [
    "One room",
    "Two rooms",
    "Three or more rooms",
    "Whole exterior",
    "Not sure",
  ],
};
export function ProjectIntake(props: Props) {
  const [session, setSession] = useState(() => startingSession(props));
  const [photos, setPhotos] = useProjectPhotos();
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [progress, setProgress] = useState("");
  const [other, setOther] = useState(false),
    [customBudget, setCustomBudget] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const operation = useRef(false);
  const finished = useRef(false);
  const photoWrites = useRef(Promise.resolve());
  const photoSnapshot = useRef(photos);
  const persistPhotoSnapshot = () => {
    if (finished.current) return Promise.resolve();
    const snapshot = photoSnapshot.current;
    const write = photoWrites.current
      .catch(() => {})
      .then(() => {
        if (!finished.current)
          return saveIntakePhotos(session.photoKey, snapshot);
      });
    photoWrites.current = write;
    return write;
  };
  const { draft, step } = session;
  const steps = intakeSteps(draft);
  const index = Math.max(0, steps.indexOf(step));
  const question = intakeQuestions(draft.category).find(
    (q) => step === "question:" + q.id,
  );
  const patch = (values: Partial<IntakeDraft>) =>
    setSession((s) => ({ ...s, draft: { ...s.draft, ...values } }));
  const move = (next: string) => {
    setSession((s) => ({ ...s, step: next }));
    setError("");
    setNotice("");
    setOther(false);
  };
  useEffect(() => {
    let disposed = false;
    if (!session.photoCount) {
      setReady(true);
      return;
    }
    void loadIntakePhotos(session.photoKey)
      .then((rows) => {
        if (disposed) {
          rows.forEach((p) => URL.revokeObjectURL(p.preview));
          return;
        }
        setPhotos(rows);
        if (rows.length !== session.photoCount)
          setNotice(
            "Some photos could not be restored. You can add them again before publishing.",
          );
      })
      .catch(() => {
        if (!disposed)
          setNotice(
            "Photos could not be restored. Add them again before publishing.",
          );
      })
      .finally(() => {
        if (!disposed) setReady(true);
      });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step, ready]);
  // Tab-scoped details survive auth redirects/reloads; no anonymous server draft.
  useEffect(() => {
    if (!ready || finished.current) return;
    try {
      sessionStorage.setItem(
        INTAKE_KEY,
        JSON.stringify({
          ...session,
          photoCount: photos.length,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      setNotice(
        "Browser saving is unavailable. Keep this page open until you finish.",
      );
    }
  }, [session, photos, ready]);
  useEffect(() => {
    photoSnapshot.current = photos;
    if (!ready || finished.current || (!photos.length && !session.photoCount))
      return;
    const timer = setTimeout(() => {
      if (finished.current) return;
      void persistPhotoSnapshot().catch(() =>
        setNotice(
          "Photos could not be saved in this browser. Keep this page open and retry before signing in.",
        ),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [photos, ready]);
  async function perform(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function startOver() {
    if (session.savedProjectId) return;
    if (
      !window.confirm(
        "Start over? This clears your answers, selected photos, and saved draft. Published projects are not affected.",
      )
    )
      return;
    // Keep pending photo writes from restoring discarded images during reset.
    finished.current = true;
    try {
      await photoWrites.current.catch(() => {});
      if (session.draftUpdatedAt && props.data?.user.role === "customer")
        await request(
          "/project-draft",
          { updatedAt: session.draftUpdatedAt },
          "DELETE",
        );
      await saveIntakePhotos(session.photoKey, []);
      sessionStorage.removeItem(INTAKE_RESUME);
      const fresh = freshIntakeSession(props.data?.user.id || null);
      sessionStorage.setItem(INTAKE_KEY, JSON.stringify(fresh));
      photoSnapshot.current = [];
      setPhotos([]);
      setSession(fresh);
      setOther(false);
      setCustomBudget(false);
      setError("");
      setProgress("");
      setNotice("Started a new project. Enter your ZIP code to begin.");
      heading.current?.focus();
    } finally {
      finished.current = false;
    }
  }
  async function persistPhotos() {
    if (photos.length || session.photoCount) await persistPhotoSnapshot();
    sessionStorage.setItem(
      INTAKE_KEY,
      JSON.stringify({
        ...session,
        photoCount: photos.length,
        updatedAt: Date.now(),
      }),
    );
  }
  async function next() {
    if (step === "zip") {
      if (!/^\d{5}$/.test(draft.zip))
        throw new Error("Enter a five-digit ZIP code.");
      const location = await request<{ zip: string; label: string }>(
        "/intake/locations/zip?zip=" + draft.zip,
      );
      patch({ zipLabel: location.label });
    } else if (step === "address" && draft.placeId && !draft.addressZip) {
      const selected = await request<{
        zip: string;
        label: string;
        placeId: string;
      }>(
        "/intake/locations/details?placeId=" +
          encodeURIComponent(draft.placeId) +
          "&sessionToken=" +
          crypto.randomUUID(),
      );
      if (selected.zip !== draft.zip)
        throw new Error(
          "This address has a different ZIP. Update your ZIP or choose another address.",
        );
      patch({
        addressZip: selected.zip,
        address: selected.label,
        placeId: selected.placeId,
      });
    } else {
      const problem = stepProblem(step, draft);
      if (problem) throw new Error(problem);
    }
    if (step === "photos") await persistPhotos();
    move(steps[index + 1]);
  }
  async function finish() {
    const invalid = firstInvalidStep(draft);
    if (invalid) {
      move(invalid);
      throw new Error(
        stepProblem(invalid, draft) || "Please review the project details.",
      );
    }
    const checked = projectSchema.safeParse(projectPayload(draft));
    if (!checked.success)
      throw new Error(
        checked.error.issues[0]?.message || "Please review your answers.",
      );
    const payload = checked.data;
    if (!props.data) {
      await persistPhotos();
      sessionStorage.setItem(INTAKE_RESUME, "yes");
      props.onAuthenticate();
      return;
    }
    if (props.data.user.role !== "customer")
      throw new Error("Sign in with a customer account to post this project.");
    let current = session;
    const signature = JSON.stringify(payload);
    if (!current.savedProjectId && current.signature !== signature)
      current = { ...current, signature, clientKey: crypto.randomUUID() };
    setSession(current);
    sessionStorage.setItem(
      INTAKE_KEY,
      JSON.stringify({
        ...current,
        updatedAt: Date.now(),
        photoCount: photos.length,
      }),
    );
    setProgress("Publishing your project…");
    const result = current.savedProjectId
      ? { id: current.savedProjectId }
      : await request<{ id: string }>("/projects", {
          ...payload,
          expectedZip: draft.zip,
          clientKey: current.clientKey,
        });
    current = { ...current, savedProjectId: result.id };
    setSession(current);
    sessionStorage.setItem(
      INTAKE_KEY,
      JSON.stringify({
        ...current,
        updatedAt: Date.now(),
        photoCount: photos.length,
      }),
    );
    try {
      await publishProjectPhotos(result.id, photos, setProgress);
    } catch (e) {
      await saveIntakePhotos(current.photoKey, photos).catch(() => {});
      setProgress(
        "Your project is published. Retry the remaining photos or open your matches below.",
      );
      throw e;
    }
    if (current.draftUpdatedAt)
      await request(
        "/project-draft",
        { updatedAt: current.draftUpdatedAt },
        "DELETE",
      ).catch(() => {});
    finished.current = true;
    await photoWrites.current.catch(() => {});
    await saveIntakePhotos(current.photoKey, []).catch(() => {});
    sessionStorage.removeItem(INTAKE_KEY);
    sessionStorage.removeItem(INTAKE_RESUME);
    setPhotos([]);
    await props.onPublished(result.id);
  }
  async function saveDraft() {
    await persistPhotos();
    if (props.data?.user.role === "customer") {
      const saved = await request<{ updatedAt: string }>(
        "/project-draft",
        draft,
        "PUT",
      );
      setSession((s) => ({ ...s, draftUpdatedAt: saved.updatedAt }));
      setNotice(
        "Draft details saved to your dashboard. Photos remain in this browser until you publish.",
      );
    } else
      setNotice(
        "Saved in this browser tab for 24 hours. Nothing has been published or sent to professionals.",
      );
  }
  const t = useT();
  const title =
    question?.label ||
    (
      {
        zip: "Where do you need help?",
        category: "What can we help you with?",
        timing: "When would you like help?",
        budget: "Do you have a budget in mind?",
        notes: "Anything else your professional should know?",
        contact: "How can matching professionals reach you?",
        address: "What is the service address?",
        unit: "Is there an apartment or unit number?",
        photos: "Want to show us the project?",
        review: "Your project, ready to review.",
      } as Record<string, string>
    )[step];
  const answer = question ? draft.intake[question.id] || "" : "";
  const customAnswer =
    other ||
    answer === "Other" ||
    answer.startsWith("Other:") ||
    (!!question &&
      !!answer &&
      !!(question.options || textOptions[question.id]) &&
      !(question.options || textOptions[question.id]).includes(answer));
  const budgetChoice = customBudget
    ? "Set my own budget"
    : intakeBudgetChoice(draft);
  const changeAnswer = (value: string) =>
    patch({ intake: { ...draft.intake, [question!.id]: value } });
  if (!ready)
    return (
      <p role="status">
        <T>{"Restoring your project…"}</T>
      </p>
    );
  return (
    <section className="project-intake" aria-label="Project request">
      <div className="intake-topline">
        <span>
          <T>{"YOUR HOME. YOUR NEXT PROJECT."}</T>
        </span>
        <span>
          {index + 1} / {steps.length}
        </span>
      </div>
      {!session.savedProjectId && (
        <button
          type="button"
          className="text-button intake-restart"
          disabled={busy}
          onClick={() => void perform(startOver)}
        >
          Start over
        </button>
      )}
      <progress
        className="intake-progress"
        aria-label="Project request progress"
        value={index + 1}
        max={steps.length}
      />
      <div className="intake-context">
        <span>
          <MapPin size={16} />
          {draft.zipLabel || "New Jersey"}
        </span>
        <span>{step !== "zip" && <T>{draft.category}</T>}</span>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        <T>{title}</T>
      </h1>
      {step === "zip" && (
        <p>
          <T>
            {
              "Start with your ZIP. Tell us about the job, then sign in to publish and meet matching pros."
            }
          </T>{" "}
        </p>
      )}
      {step === "category" && (
        <p>
          <T>
            {
              "Choose the main service. Your next questions will fit the work you need."
            }
          </T>{" "}
        </p>
      )}
      {step === "address" && (
        <p>
          <T>
            {
              "Your exact address is shared only with your selected professional. Other matching pros see your ZIP."
            }
          </T>{" "}
        </p>
      )}
      {step === "review" && (
        <p>
          {props.data
            ? "Review your answers and publish when you’re ready."
            : "One last step: sign in or create a customer account. Your answers and photos will come with you."}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void perform(step === "review" ? finish : next);
        }}
      >
        <fieldset
          disabled={busy || !!session.savedProjectId}
          className="intake-fields"
        >
          {step === "zip" && (
            <Field label="Project ZIP code">
              <span className="intake-location-input">
                <MapPin size={22} aria-hidden="true" />
                <input
                  autoComplete="postal-code"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  required
                  value={draft.zip}
                  onChange={(e) =>
                    patch({
                      zip: e.target.value.replace(/\D/g, ""),
                      zipLabel: "",
                    })
                  }
                  placeholder="e.g. 08859"
                />
              </span>
              <small className="intake-field-hint">
                <T>
                  {"Enter the five-digit ZIP where you need the work done."}
                </T>{" "}
              </small>
            </Field>
          )}
          {step === "category" && (
            <div className="intake-choices category-choices">
              {categories.map((category) => (
                <button
                  type="button"
                  aria-pressed={draft.category === category}
                  className={
                    draft.category === category
                      ? "intake-choice selected"
                      : "intake-choice"
                  }
                  key={category}
                  onClick={() =>
                    category !== draft.category &&
                    patch({ category, intake: {}, title: "", proId: null })
                  }
                >
                  <ServiceIcon service={category} />
                  <span>
                    <T>{category}</T>
                  </span>
                  {draft.category === category && <Check size={18} />}
                </button>
              ))}
            </div>
          )}
          {question && (
            <>
              {(question.type === "select" || textOptions[question.id]) && (
                <Choices
                  options={[
                    ...(
                      question.options ||
                      textOptions[question.id] ||
                      []
                    ).filter((v) => v !== "Other"),
                    "Other",
                  ]}
                  value={customAnswer ? "Other" : answer}
                  onChange={(value) => {
                    setOther(value === "Other");
                    changeAnswer(value === "Other" ? "Other: " : value);
                  }}
                />
              )}
              {(customAnswer ||
                (question.type !== "select" && !textOptions[question.id])) && (
                <Field label={customAnswer ? "Tell us more" : "Your answer"}>
                  <textarea
                    required
                    maxLength={1490}
                    rows={3}
                    value={
                      customAnswer
                        ? answer.replace(/^Other: ?/, "").replace(/^Other$/, "")
                        : answer
                    }
                    placeholder={t(
                      question.placeholder || "Describe what you need",
                    )}
                    onChange={(e) =>
                      changeAnswer(
                        (customAnswer ? "Other: " : "") + e.target.value,
                      )
                    }
                  />
                </Field>
              )}
              {(draft.category === "Electrical" ||
                draft.category === "Plumbing") && (
                <small>
                  <T>
                    {
                      "Aplime is not an emergency service. For immediate danger, contact emergency services or your utility."
                    }
                  </T>{" "}
                </small>
              )}
            </>
          )}
          {step === "timing" && (
            <Choices
              options={[
                "As soon as possible",
                "This week",
                "This month",
                "Flexible",
              ]}
              value={
                {
                  urgent: "As soon as possible",
                  this_week: "This week",
                  this_month: "This month",
                  flexible: "Flexible",
                  "": "",
                }[draft.urgency]
              }
              onChange={(value) =>
                patch({
                  urgency: (
                    {
                      "As soon as possible": "urgent",
                      "This week": "this_week",
                      "This month": "this_month",
                      Flexible: "flexible",
                    } as Record<string, IntakeDraft["urgency"]>
                  )[value],
                })
              }
            />
          )}
          {step === "budget" && (
            <>
              <Choices
                options={[
                  "I’d like advice / Not sure",
                  "Under $500",
                  "$500–$2,000",
                  "$2,000–$5,000",
                  "Set my own budget",
                ]}
                value={budgetChoice}
                onChange={(v) => {
                  setCustomBudget(v === "Set my own budget");
                  if (v !== "Set my own budget")
                    patch(
                      v === "Under $500"
                        ? { budgetMin: null, budgetMax: 50000 }
                        : v === "$500–$2,000"
                          ? { budgetMin: 50000, budgetMax: 200000 }
                          : v === "$2,000–$5,000"
                            ? { budgetMin: 200000, budgetMax: 500000 }
                            : { budgetMin: null, budgetMax: null },
                    );
                }}
              />
              {budgetChoice === "Set my own budget" && (
                <div className="form-grid">
                  {(["budgetMin", "budgetMax"] as const).map((key) => (
                    <Field
                      key={key}
                      label={
                        key === "budgetMin"
                          ? "Minimum (optional, USD)"
                          : "Maximum (optional, USD)"
                      }
                    >
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        step="0.01"
                        value={draft[key] === null ? "" : draft[key]! / 100}
                        onChange={(e) =>
                          patch({
                            [key]: e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              )}
              <p className="muted">
                <T>
                  {"This helps pros prepare estimates. No payment is taken."}
                </T>{" "}
              </p>
            </>
          )}
          {step === "notes" && (
            <Field label="Extra details (optional)">
              <textarea
                value={draft.description}
                maxLength={4000}
                rows={4}
                placeholder="Measurements, access instructions, or anything your answers haven’t covered…"
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          )}
          {step === "address" && (
            <AddressAutocomplete
              label="Full service address"
              publicIntake
              defaultAddress={draft.address}
              defaultPlaceId={draft.placeId}
              onSelect={(value) =>
                patch({
                  address: value.address,
                  placeId: value.placeId,
                  addressZip: value.zip || "",
                })
              }
            />
          )}
          {step === "unit" && (
            <Field label="Apartment / unit (optional)">
              <input
                value={draft.addressUnit}
                maxLength={100}
                onChange={(e) => patch({ addressUnit: e.target.value })}
                placeholder="Leave blank if this does not apply"
              />
            </Field>
          )}
          {step === "contact" && (
            <div>
              <Field label="Phone number">
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                  value={draft.contactPhone}
                  placeholder="(201) 555-0123"
                  onChange={(e) =>
                    patch({
                      contactPhone: e.target.value,
                      contactConsent: false,
                    })
                  }
                />
              </Field>
              <label className="project-contact-consent">
                <input
                  type="checkbox"
                  checked={draft.contactConsent}
                  onChange={(e) => patch({ contactConsent: e.target.checked })}
                />
                <span>
                  <T>{CONTACT_CONSENT}</T>
                </span>
              </label>
            </div>
          )}
          {step === "photos" && (
            <ProjectPhotos
              photos={photos}
              onChange={setPhotos}
              disabled={busy}
              editing
            />
          )}
          {step === "review" && (
            <div className="intake-review">
              <Field label="Project title">
                <input
                  required
                  maxLength={120}
                  value={draft.title || `${draft.category} project`}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <dl>
                {[
                  ["ZIP / town", draft.zipLabel, "zip"],
                  ["Service", draft.category, "category"],
                  ["Phone number", draft.contactPhone, "contact"],
                  ...intakeQuestions(draft.category).map((q) => [
                    q.label,
                    draft.intake[q.id],
                    "question:" + q.id,
                  ]),
                  ["Timing", draft.urgency.replaceAll("_", " "), "timing"],
                  [
                    "Budget",
                    draft.budgetMin === null && draft.budgetMax === null
                      ? "Discuss with professional"
                      : `${draft.budgetMin === null ? "Any" : money(draft.budgetMin)} – ${draft.budgetMax === null ? "Any" : money(draft.budgetMax)}`,
                    "budget",
                  ],
                  [
                    "Extra details",
                    draft.description || "No extra notes",
                    "notes",
                  ],
                  ["Service address", draft.address, "address"],
                  [
                    "Apartment / unit",
                    draft.addressUnit || "Not applicable",
                    "unit",
                  ],
                  ["Photos", `${photos.length} selected`, "photos"],
                ].map(([label, value, target]) => (
                  <div key={label}>
                    <dt>
                      <T>{label}</T>
                    </dt>
                    <dd>
                      {target === "category" ||
                      (target.startsWith("question:") &&
                        intakeQuestions(draft.category)
                          .find((q) => "question:" + q.id === target)
                          ?.options?.includes(value))
                        ? t(value)
                        : value}
                    </dd>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={t("Edit") + " " + t(label)}
                      onClick={() => move(target)}
                    >
                      <T>{"Edit"}</T>{" "}
                    </button>
                  </div>
                ))}
              </dl>
              <div className="intake-assurance">
                <ShieldCheck size={24} />
                <p>
                  <T>
                    {
                      "We match your service and location with professionals’ preferences, service radius and current eligibility. We alert up to five matches first. You choose who to contact and hire; publishing does not book a service."
                    }
                  </T>{" "}
                </p>
              </div>
            </div>
          )}
        </fieldset>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {(notice || progress) && (
          <p className="alert" role="status">
            {notice || progress}
          </p>
        )}
        <div className="intake-navigation">
          {index > 0 && !session.savedProjectId && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => move(steps[index - 1])}
            >
              <ArrowLeft size={18} /> <T>{"Back"}</T>{" "}
            </button>
          )}
          <button disabled={busy} type="submit">
            {t(
              busy
                ? "Please wait…"
                : step === "review"
                  ? session.savedProjectId
                    ? "Retry remaining photos"
                    : props.data
                      ? "Publish & see matching pros"
                      : "Sign in to finish"
                  : "Continue",
            )}
            <ArrowRight size={18} />
          </button>
        </div>
        {session.savedProjectId ? (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (session.draftUpdatedAt)
                  await request(
                    "/project-draft",
                    { updatedAt: session.draftUpdatedAt },
                    "DELETE",
                  ).catch(() => {});
                finished.current = true;
                await photoWrites.current.catch(() => {});
                sessionStorage.removeItem(INTAKE_KEY);
                sessionStorage.removeItem(INTAKE_RESUME);
                await saveIntakePhotos(session.photoKey, []).catch(() => {});
                await props.onPublished(session.savedProjectId!);
              })
            }
          >
            <T>{"Open published project & matches"}</T>{" "}
          </button>
        ) : (
          <button
            type="button"
            className="text-button intake-save"
            disabled={busy}
            onClick={() => void perform(saveDraft)}
          >
            <T>{"Save for later"}</T>{" "}
          </button>
        )}
        <small className="intake-storage-note">
          <T>
            {
              "Before publishing, answers and selected photos are kept temporarily in this browser tab for up to 24 hours."
            }
          </T>{" "}
          {props.data
            ? "Use Save for later to keep draft details on your dashboard."
            : "No account is needed until the final step."}
        </small>
      </form>
    </section>
  );
}
