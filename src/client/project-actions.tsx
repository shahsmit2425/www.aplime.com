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
  HelpCircle,
  MapPin,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  Star,
  Users,
} from "lucide-react";
import type { Project } from "../shared/domain.js";
import { money } from "../shared/domain.js";
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
  if (data.user.role !== "customer") return null;
  const saved = data.saved.includes(proId);
  const name = saved ? "Unsave professional" : "Save professional";
  return (
    <button
      type="button"
      className={"favorite-button " + (label ? "secondary" : "icon-button")}
      aria-label={name}
      aria-pressed={saved}
      disabled={busy}
      onClick={() =>
        void run(
          () => request("/saved/" + proId, { saved: !saved }),
          saved ? "Removed from your saved pros." : "Professional saved.",
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
  const reviewed = data.reviews.some((r) => r.projectId === p.id);
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
        <MessageCircle size={17} /> Messages
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
        <Pencil size={17} /> Edit details
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
        <MessageCircle size={17} /> Message
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
  if (customer && p.status === "completed" && p.proId) {
    if (!reviewed)
      add(
        "review",
        <button onClick={() => go("reviews")}>
          <Star size={17} /> Leave a review
        </button>,
      );
    add("save", <SavePro proId={p.proId} label />);
    add(
      "again",
      <button className="secondary" onClick={() => go("projects", p.proId!)}>
        <RotateCcw size={17} /> Hire again
      </button>,
    );
  } else if (customer && live && p.proId)
    add("save", <SavePro proId={p.proId} label />);
  add(
    "help",
    <button className="text-button" onClick={() => go("help")}>
      <HelpCircle size={17} /> Get help
    </button>,
  );
  if (!buttons.length) return null;
  return (
    <nav className="project-actions actions" aria-label="Project actions">
      {buttons}
    </nav>
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
  const dollars = (n: number | null) => (n === null ? "" : String(n / 100));
  const cents = (v: FormDataEntryValue | null) =>
    String(v ?? "").trim() === "" ? null : Math.round(Number(v) * 100);
  return (
    <Panel title="Edit project details">
      <p>
        Professionals who sent estimates or messages will be told you changed
        the request. Address and category stay the same; start a new project to
        change them.
      </p>
      <Form
        busy={busy}
        onSubmit={(f) =>
          run(async () => {
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
                urgency: f.get("urgency"),
                budgetMin: cents(f.get("budgetMin")),
                budgetMax: cents(f.get("budgetMax")),
              });
              onDone();
            } finally {
              setUploading("");
            }
          }, "Project details and photos updated.")
        }
      >
        <Field label="Project title">
          <input
            name="title"
            defaultValue={p.title}
            minLength={5}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            defaultValue={p.description}
            minLength={20}
            maxLength={4000}
            required
          />
        </Field>
        <Field label="Timing">
          <select name="urgency" defaultValue={p.urgency}>
            <option value="urgent">Urgent</option>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="flexible">Flexible</option>
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
          Cancel
        </button>
      </Form>
    </Panel>
  );
}
