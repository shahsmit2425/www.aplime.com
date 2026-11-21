import { ProjectContact } from "./project-contact.js";
import { T } from "../shared/language.js";
import { discussionRoute } from "../shared/chat.js";
import {
  useProjectPhotos,
  ProjectPhotos,
  stageProjectPhoto,
} from "./project-photos.js";
import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  Send,
  Star,
  Users,
} from "lucide-react";
import type { Project } from "../shared/domain.js";
import { money } from "../shared/domain.js";
import {
  categories,
  questionsFor,
  type ServiceCategory,
  type ServiceQuestion,
} from "../shared/service-questionnaires.js";
import { propertyTypeFor } from "./project-intake-state.js";
import { AddressAutocomplete } from "./address-autocomplete.js";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Panel, Form, Field } from "./ui.js";
import { appointmentIcs, directionsUrl, downloadIcs } from "./calendar.js";

export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  for (
    let parent: HTMLElement | null = el;
    parent;
    parent = parent.parentElement
  ) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => {
    const focusable =
      el.querySelector<HTMLElement>("textarea,input,select") ||
      el.querySelector<HTMLElement>("button,summary");
    focusable?.focus({ preventScroll: true });
  }, 350);
}

export function SavePro({
  proId,
  label = false,
}: {
  proId: string;
  label?: boolean;
}) {
  const { data, run, busy } = useWorkspace();
  const [justSaved, setJustSaved] = useState(false);
  if (data.user.role !== "customer") return null;
  const saved = data.saved.includes(proId);
  const name = saved ? "Unsave professional" : "Save professional";
  return (
    <button
      type="button"
      className={
        "favorite-button " +
        (label ? "secondary" : "icon-button") +
        (justSaved && saved ? " just-saved" : "")
      }
      aria-label={name}
      aria-pressed={saved}
      disabled={busy}
      onClick={() =>
        void run(
          () => request("/saved/" + proId, { saved: !saved }),
          saved ? "Removed from your saved pros." : "Professional saved.",
          () => setJustSaved(!saved),
        )
      }
    >
      <Heart size={label ? 17 : 19} fill={saved ? "currentColor" : "none"} />
      {label && (saved ? " Saved" : " Save professional")}
    </button>
  );
}

export function ChatWithPro({
  projectId,
  proId,
  label = "Chat with this pro",
  secondary = true,
}: {
  projectId: string;
  proId: string;
  label?: string;
  secondary?: boolean;
}) {
  const { run, busy, go } = useWorkspace();
  return (
    <button
      type="button"
      className={secondary ? "secondary" : ""}
      disabled={busy}
      onClick={() =>
        void run(async () => {
          const thread = await request(
            "/projects/" + projectId + "/discussions/" + proId,
            {},
          );
          go("messages", discussionRoute(thread.id, projectId));
        }, "")
      }
    >
      <MessageCircle size={17} /> {label}
    </button>
  );
}

export function ProjectActionBar({
  project: p,
  canRespond,
  hasEstimates,
  hasOwnEstimate,
  onPropose,
  onEdit,
  compact = false,
}: {
  project: Project;
  canRespond: boolean;
  hasEstimates: boolean;
  hasOwnEstimate: boolean;
  onPropose: () => void;
  onEdit: () => void;
  compact?: boolean;
}) {
  const { data, run, busy, go } = useWorkspace();
  const customer = p.customerId === data.user.id;
  const assigned = p.proId === data.user.id;
  const pro = data.user.role === "pro";
  const open = ["requested", "quoted"].includes(p.status);
  const live = ["booked", "in_progress", "paused"].includes(p.status);
  const buttons: React.ReactNode[] = [];
  const add = (key: string, node: React.ReactNode) => {
    if (
      compact &&
      ["find", "compare", "chat", "open-chat", "edit", "help"].includes(key)
    )
      return;
    buttons.push(<span key={key}>{node}</span>);
  };
  if (customer && open) {
    if (!p.proId)
      add(
        "find",
        <button onClick={() => jumpTo("project-professionals")}>
          <Users size={17} /> Professionals
        </button>,
      );
    if (hasEstimates)
      add(
        "compare",
        <button
          className="secondary"
          onClick={() => jumpTo("project-estimates")}
        >
          <Star size={17} /> Compare estimates
        </button>,
      );
    add(
      "chat",
      <button className="secondary" onClick={() => go("messages", p.id)}>
        <MessageCircle size={17} /> <T>{"Messages"}</T>{" "}
      </button>,
    );
    if (p.proId && !p.cancellationRequestedBy)
      add(
        "propose",
        <button className="secondary" disabled={busy} onClick={onPropose}>
          <CalendarDays size={17} /> Propose a time
        </button>,
      );
    add(
      "edit",
      <button className="secondary" onClick={onEdit}>
        <Pencil size={17} /> <T>{"Edit details"}</T>{" "}
      </button>,
    );
  }
  if (pro && !customer && open && (!p.proId || assigned)) {
    add(
      "message",
      <button
        className="secondary"
        onClick={() =>
          void run(async () => {
            const thread = await request(`/projects/${p.id}/discussions`, {});
            go("messages", discussionRoute(thread.id, p.id));
          }, "")
        }
        disabled={busy || !canRespond}
      >
        <MessageCircle size={17} /> Message customer
      </button>,
    );
    if (assigned && !p.cancellationRequestedBy)
      add(
        "propose",
        <button className="secondary" disabled={busy} onClick={onPropose}>
          <CalendarDays size={17} /> Propose a time
        </button>,
      );
    add(
      "quote",
      <button onClick={() => jumpTo("estimate-form")} disabled={!canRespond}>
        <Send size={17} />{" "}
        {hasOwnEstimate ? "Update estimate" : "Send estimate"}
      </button>,
    );
  }
  if ((customer || assigned) && p.proId && (live || p.status === "completed")) {
    add(
      "open-chat",
      <button className="secondary" onClick={() => go("messages", p.id)}>
        <MessageCircle size={17} /> <T>{"Message"}</T>{" "}
      </button>,
    );
  }
  if (p.proId && (customer || assigned) && live) {
    if (p.status === "booked" && !p.cancellationRequestedBy)
      add(
        "propose",
        <button className="secondary" disabled={busy} onClick={onPropose}>
          <CalendarDays size={17} /> Propose a time
        </button>,
      );
  }
  if ((customer || assigned) && p.scheduledAt && live)
    add(
      "ics",
      <button
        className="secondary"
        onClick={() =>
          downloadIcs(
            p.title,
            appointmentIcs({
              id: p.id,
              title: p.title,
              startsAt: p.scheduledAt!,
              location: [p.address, p.addressUnit].filter(Boolean).join(" "),
              description: p.proName
                ? `Aplime project with ${p.proName}${p.amount ? " · " + money(p.amount) : ""}`
                : "Aplime project",
            }),
          )
        }
      >
        <CalendarPlus size={17} /> Add to calendar
      </button>,
    );
  if (assigned && p.address && live)
    add(
      "directions",
      <button
        className="secondary"
        onClick={() =>
          void openExternal(
            directionsUrl([p.address, p.addressUnit].filter(Boolean).join(" ")),
          )
        }
      >
        <MapPin size={17} /> Directions
      </button>,
    );
  if (customer && p.proId && (live || p.status === "completed"))
    add("save", <SavePro proId={p.proId} label />);
  if (!buttons.length) return null;
  return (
    <nav className="project-actions actions" aria-label="Project actions">
      {buttons}
    </nav>
  );
}

// Stored answers that no longer match the questionnaire are kept as a written answer.
function storedAnswers(p: Project, category: ServiceCategory) {
  return Object.fromEntries(
    questionsFor(category).flatMap((q) => {
      const answer = p.intake?.[q.id]?.trim();
      if (!answer) return [];
      const known =
        !q.options ||
        q.options.includes(answer) ||
        answer.startsWith("Other: ");
      return [[q.id, known ? answer : ("Other: " + answer).slice(0, 1500)]];
    }),
  ) as Record<string, string>;
}

function EditAnswer({
  question: q,
  value,
  required,
  onChange,
}: {
  question: ServiceQuestion;
  value: string;
  required: boolean;
  onChange: (value: string) => void;
}) {
  if (q.type === "select" && q.options) {
    const custom = value === "Other" || value.startsWith("Other:");
    return (
      <>
        <Field label={q.label}>
          <select
            value={custom ? "Other" : value}
            required={required}
            onChange={(e) =>
              onChange(e.target.value === "Other" ? "Other: " : e.target.value)
            }
          >
            <option value="">Choose an answer</option>
            {[...q.options.filter((o) => o !== "Other"), "Other"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        {custom && (
          <Field label="Describe your answer">
            <input
              value={value.replace(/^Other: ?/, "").replace(/^Other$/, "")}
              maxLength={1493}
              pattern=".*\S.*"
              required
              onChange={(e) => onChange("Other: " + e.target.value)}
            />
          </Field>
        )}
      </>
    );
  }
  return (
    <Field label={q.label}>
      {q.type === "textarea" ? (
        <textarea
          value={value}
          maxLength={1500}
          placeholder={q.placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={value}
          maxLength={1500}
          placeholder={q.placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function EditDetails({
  project: p,
  submit,
  onDone,
}: {
  project: Project;
  submit: (body: unknown) => Promise<unknown>;
  onDone: () => void;
}) {
  const { run, busy, data } = useWorkspace();
  const [original] = useState(() =>
    data.uploads.filter(
      (f) =>
        f.projectId === p.id &&
        f.status === "ready" &&
        f.contentType.startsWith("image/"),
    ),
  );
  const [existing, setExisting] = useState(original);
  const [photos, setPhotos] = useProjectPhotos(true);
  const [uploading, setUploading] = useState("");
  const saved = (categories as readonly string[]).includes(p.category)
    ? (p.category as ServiceCategory)
    : "";
  const [category, setCategory] = useState<ServiceCategory | "">(saved);
  const [answers, setAnswers] = useState(() =>
    saved ? storedAnswers(p, saved) : {},
  );
  const [urgency, setUrgency] = useState(p.urgency);
  const [propertyType, setPropertyType] = useState(p.propertyType);
  const [moving, setMoving] = useState(false);
  const questions = category ? questionsFor(category) : [];
  const asksProperty = questions.some((q) => q.id === "propertyType");
  const dollars = (n: number | null) => (n === null ? "" : String(n / 100));
  const cents = (v: FormDataEntryValue | null) =>
    String(v ?? "").trim() === "" ? null : Math.round(Number(v) * 100);
  if (!["requested", "quoted"].includes(p.status))
    return (
      <Panel title="Project privacy">
        <p>
          Project fields and photos are locked at this stage. You can still
          change whether professionals may contact you by phone.
        </p>
        <ProjectContact projectId={p.id} />
        <button type="button" className="secondary" onClick={onDone}>
          Done
        </button>
      </Panel>
    );
  return (
    <Panel title="Edit project details">
      <p>
        Professionals who sent estimates or messages will be told you changed
        the request.
      </p>
      <ProjectContact projectId={p.id} />
      <Form
        busy={busy}
        onSubmit={(f) =>
          run(async () => {
            const placeId = String(f.get("placeId") || "");
            try {
              for (let i = 0; i < photos.length; i++) {
                setUploading(`Uploading photo ${i + 1} of ${photos.length}…`);
                await stageProjectPhoto(p.id, photos[i]);
              }
              await submit({
                type: "update_details",
                photos: {
                  expectedIds: original
                    .filter((f) => f.userId === data.user.id)
                    .map((f) => f.id),
                  photoIds: [
                    ...existing
                      .filter((f) => f.userId === data.user.id)
                      .map((f) => f.id),
                    ...photos.map((photo) => photo.uploadId!),
                  ],
                },
                title: f.get("title"),
                description: f.get("description"),
                urgency,
                budgetMin: cents(f.get("budgetMin")),
                budgetMax: cents(f.get("budgetMax")),
                ...(category
                  ? {
                      category,
                      intake: Object.fromEntries(
                        questions
                          .map((q) => [q.id, (answers[q.id] || "").trim()])
                          .filter(([, answer]) => answer),
                      ),
                    }
                  : {}),
                propertyType: !asksProperty
                  ? propertyType
                  : answers.propertyType
                    ? propertyTypeFor(answers.propertyType)
                    : undefined,
                addressUnit: f.get("addressUnit"),
                ...(placeId && placeId !== p.placeId ? { placeId } : {}),
              });
              for (const photo of photos) photo.saved = true;
              onDone();
            } finally {
              setUploading("");
            }
          }, "Project details and photos updated.")
        }
      >
        <h3 className="edit-section">Service</h3>
        <Field label="Service">
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as ServiceCategory;
              setCategory(next);
              setAnswers(next === saved ? storedAnswers(p, next) : {});
            }}
          >
            {!saved && <option value="">{p.category}</option>}
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {questions.map((q) => (
          <EditAnswer
            key={category + q.id}
            question={q}
            value={answers[q.id] || ""}
            required={!!q.required && urgency !== "urgent"}
            onChange={(value) => setAnswers({ ...answers, [q.id]: value })}
          />
        ))}
        {!asksProperty && (
          <Field label="Property type">
            <select
              value={propertyType}
              onChange={(e) =>
                setPropertyType(e.target.value as Project["propertyType"])
              }
            >
              <option value="home">Single-family home or townhome</option>
              <option value="apartment">Apartment</option>
              <option value="condo">Condo</option>
              <option value="commercial">Commercial property</option>
              <option value="other">Other</option>
            </select>
          </Field>
        )}
        <h3 className="edit-section">Project</h3>
        <Field label="Project title">
          <input name="title" defaultValue={p.title} maxLength={120} required />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            defaultValue={p.description}
            maxLength={4000}
            required
          />
        </Field>
        <h3 className="edit-section">Location</h3>
        {moving ? (
          <>
            <AddressAutocomplete label="New project address" />
            <button
              type="button"
              className="text-button"
              onClick={() => setMoving(false)}
            >
              Keep current address
            </button>
          </>
        ) : (
          <div className="edit-address">
            <span>Project address</span>
            <p>{p.address || "ZIP " + p.zip}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => setMoving(true)}
            >
              Change address
            </button>
          </div>
        )}
        <Field label="Apartment, suite or unit (optional)">
          <input
            name="addressUnit"
            defaultValue={p.addressUnit || ""}
            maxLength={100}
            autoComplete="address-line2"
          />
        </Field>
        <h3 className="edit-section">Timing and budget</h3>
        <Field label="Timing">
          <select
            name="urgency"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Project["urgency"])}
          >
            <option value="urgent">Urgent</option>
            <option value="this_week">
              <T>{"This week"}</T>
            </option>
            <option value="this_month">
              <T>{"This month"}</T>
            </option>
            <option value="flexible">
              <T>{"Flexible"}</T>
            </option>
          </select>
        </Field>
        <Field label="Minimum budget (USD, optional)">
          <input
            name="budgetMin"
            type="number"
            min="0"
            step=".01"
            defaultValue={dollars(p.budgetMin)}
          />
        </Field>
        <Field label="Maximum budget (USD, optional)">
          <input
            name="budgetMax"
            type="number"
            min="0"
            step=".01"
            defaultValue={dollars(p.budgetMax)}
          />
        </Field>
        <ProjectPhotos
          photos={photos}
          onChange={setPhotos}
          existing={existing}
          readOnlyIds={existing
            .filter((f) => f.userId !== data.user.id)
            .map((f) => f.id)}
          onExistingChange={setExisting}
          editing
          disabled={busy}
        />
        {data.uploads.some(
          (f) =>
            f.projectId === p.id &&
            f.userId === data.user.id &&
            f.status === "pending" &&
            !photos.some((photo) => photo.uploadId === f.id),
        ) && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              const unfinished = data.uploads.filter(
                (f) =>
                  f.projectId === p.id &&
                  f.userId === data.user.id &&
                  f.status === "pending" &&
                  !photos.some((photo) => photo.uploadId === f.id),
              );
              if (
                window.confirm(
                  "Discard unfinished uploads? Saved project photos will stay unchanged.",
                )
              )
                void run(async () => {
                  for (const f of unfinished)
                    await request(`/uploads/${f.id}`, undefined, "DELETE");
                }, "Unfinished uploads removed.");
            }}
          >
            Discard unfinished uploads
          </button>
        )}
        {uploading && <p role="status">{uploading}</p>}
        <button>Save changes</button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onDone}
        >
          <T>{"Cancel"}</T>{" "}
        </button>
      </Form>
    </Panel>
  );
}
