import {
  ProjectCard,
  ProfessionalCard,
  CollectionHeading,
} from "./marketplace-cards.js";
import { Subscription } from "./subscription.js";
import { MessagesInbox } from "./messages.js";
import { BusinessNavigation } from "./business-navigation.js";
import { AwardResponse } from "./award-response.js";
import { ProjectControls } from "./project-controls.js";
import { businessFields } from "../shared/business.js";
import { AddressAutocomplete } from "./address-autocomplete.js";
import { Preferences } from "./preferences.js";
import { Availability } from "./availability.js";
import { BusinessProfile } from "./business-profile.js";
import { IdentityVerification } from "./identity-verification.js";
import { BusinessDisplay } from "./business-display.js";
import { Discussions } from "./discussions.js";
import {
  ProjectActionBar,
  EditDetails,
  SavePro,
  ChatWithPro,
  jumpTo,
} from "./project-actions.js";
import {
  ProjectPhotos,
  sendProjectPhoto,
  type ProjectPhoto,
} from "./project-photos.js";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  MessageCircle,
  Plus,
  Search,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Phone,
  Video,
} from "lucide-react";
import {
  categories,
  money,
  type Project,
  type Profile,
  type Upload as UploadFile,
} from "../shared/domain.js";
import {
  questionsFor,
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Empty, Head, Panel, Badge, Field, Form, ServiceIcon } from "./ui.js";
const date = (s: string | null) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled";
export function Pages() {
  const { page, data } = useWorkspace();
  return (
    <>
      {data.user.role === "pro" &&
        [
          "profile",
          "onboarding",
          "verification",
          "subscription",
          "payments",
          "earnings",
          "availability",
        ].includes(page) && <BusinessNavigation />}
      <PageContent />
    </>
  );
}
function PageContent() {
  const { page } = useWorkspace();
  switch (page) {
    case "dashboard":
      return <Dashboard />;
    case "discover":
    case "saved":
      return <Directory />;
    case "pro":
      return <ProProfile />;
    case "projects":
    case "leads":
      return <Projects />;
    case "project":
      return <ProjectDetail />;
    case "quotes":
      return <Quotes />;
    case "schedule":
      return <Schedule />;
    case "messages":
      return <Messages />;
    case "payments":
    case "earnings":
    case "subscription":
      return <Subscription />;
    case "reviews":
      return <Reviews />;
    case "availability":
      return <Preferences />;
    case "verification":
      return <IdentityVerification />;
    case "profile":
    case "onboarding":
      return <Business />;
    case "notifications":
      return <Notifications />;
    case "settings":
      return <Settings />;
    case "help":
      return <Support />;
    default:
      return (
        <>
          <Head title="Page not found." />
          <Empty>Choose a page from your navigation.</Empty>
        </>
      );
  }
}
function ProjectList({
  projects,
  compact = false,
}: {
  projects: Project[];
  compact?: boolean;
}) {
  const { go } = useWorkspace();
  return projects.length ? (
    <div className={compact ? "project-card-list" : "project-card-grid"}>
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          compact={compact}
          onOpen={() => go("project", p.id)}
        />
      ))}
    </div>
  ) : (
    <Empty title="Your next project starts here.">
      New requests and project updates will appear here.
    </Empty>
  );
}
function Dashboard() {
  const { data, go } = useWorkspace();
  const pro = data.user.role === "pro";
  const active = data.projects.filter(
    (p) => !["completed", "cancelled"].includes(p.status),
  );
  return (
    <>
      <Head
        title={"Welcome back, " + data.user.name.split(" ")[0] + "."}
        action={
          <button onClick={() => (pro ? go("leads") : go("projects", "new"))}>
            <Plus size={17} />
            {pro ? "Browse projects" : "Start a project"}
          </button>
        }
      >
        {pro
          ? "Your projects, conversations, and business in one place."
          : "Your home projects, all coming together."}
      </Head>
      <div className="stats">
        {[
          ["Active projects", active.length],
          [
            "Estimates",
            data.quotes.filter((q) => q.status === "pending").length,
          ],
          [
            "Upcoming visits",
            data.projects.filter((p) => p.status === "booked").length,
          ],
          [
            "Completed projects",
            data.projects.filter((p) => p.status === "completed").length,
          ],
        ].map(([label, value], index) => (
          <div className="stat" key={label}>
            <span className="stat-label">
              {label}
              <span className="stat-icon">
                {index === 0 ? (
                  <ServiceIcon service="Handyman" size={18} />
                ) : index === 1 ? (
                  <MessageCircle size={18} />
                ) : index === 2 ? (
                  <CalendarDays size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
              </span>
            </span>
            <strong>{value}</strong>
            <small>From your account activity</small>
          </div>
        ))}
      </div>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">
            {pro ? "GOOD WORK STARTS HERE" : "GOOD PEOPLE. GREAT WORK."}
          </p>
          <h2>
            {pro
              ? "Build a business people come back to."
              : "A happier home starts with the right people."}
          </h2>
          <p>
            {pro
              ? "Keep your profile complete and make the next connection count."
              : "From quick fixes to fresh starts, find your next go-to professional."}
          </p>
          <button onClick={() => go(pro ? "profile" : "discover")}>
            {pro ? "Your business profile" : "Find professionals"}
            <ArrowUpRight size={16} />
          </button>
        </div>
        <img src="/home.jpg" alt="Bright living room with a blue sofa" />
      </section>
      <div className="two-columns">
        <Panel title="Recent projects">
          <ProjectList
            compact
            projects={data.projects.filter((p) => !p.archived).slice(0, 4)}
          />
        </Panel>
        <Panel title="Needs your attention">
          {data.projects
            .filter(
              (p) =>
                (p.status === "in_progress" &&
                  p.completionRequested &&
                  (p.completionRequestedBy || p.proId) !== data.user.id) ||
                (p.cancellationRequestedBy &&
                  p.cancellationRequestedBy !== data.user.id) ||
                (p.proposedAt &&
                  p.proposedBy !== data.user.id &&
                  ["requested", "quoted", "booked"].includes(p.status)),
            )
            .map((p) => (
              <button
                className="project-row"
                key={p.id}
                onClick={() => go("project", p.id)}
              >
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    {p.cancellationRequestedBy
                      ? "Respond to cancellation request"
                      : p.completionRequested &&
                          (p.completionRequestedBy || p.proId) !== data.user.id
                        ? "Review completed work"
                        : "Respond to appointment proposal"}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          {pro &&
          (!data.profiles.find((p) => p.id === data.user.id)?.verified ||
            data.profiles.find((p) => p.id === data.user.id)?.reviewStatus !==
              "approved") ? (
            <>
              <ShieldCheck />
              <h3>Finish your professional setup.</h3>
              <p>
                Save your business profile, add business images, verify your
                identity, submit the listing for review, and activate your
                subscription.
              </p>
              <button onClick={() => go("profile")}>Continue setup</button>
            </>
          ) : data.notices.length ? (
            data.notices.slice(0, 3).map((n) => (
              <article className="notice-item" key={n.id}>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </article>
            ))
          ) : (
            <p>
              Project updates and requests appear here. Open a project to see
              your next step.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
function Directory() {
  const { data, page, id, run, go, busy } = useWorkspace();
  const openDiscovery = data.discoveryMode === "open";
  const [projectId, setProjectId] = useState(id || "");
  const openProjects = data.projects.filter(
    (p) => !p.proId && ["requested", "quoted"].includes(p.status),
  );
  const selectedId = openProjects.some((p) => p.id === projectId)
    ? projectId
    : openProjects[0]?.id;
  const profiles = data.profiles.filter((p) =>
    page === "saved"
      ? data.saved.includes(p.id)
      : openDiscovery
        ? p.discoverable
        : p.matchedProjectIds?.includes(selectedId),
  );
  return (
    <>
      <Head
        title={
          page === "saved"
            ? "Your saved professionals"
            : openDiscovery
              ? "Find professionals"
              : "Your project matches"
        }
      >
        {page === "saved"
          ? "Keep trusted professionals close."
          : data.marketplacePreview
            ? "Browse all saved business profiles in development, including businesses still setting up."
            : openDiscovery
              ? "Browse eligible businesses across all services and locations. Check their service area and discuss your project before booking."
              : "Up to five professionals for each project, matched by service and location."}
      </Head>
      {data.marketplacePreview && (
        <Panel title="Development preview">
          <p>
            Approval, verification, subscription, and availability do not hide
            listings in this preview. Suspended and blocked businesses remain
            excluded. Chat and estimates become available when a business
            completes its setup.
          </p>
        </Panel>
      )}
      {(page !== "saved" || openDiscovery) && openProjects.length > 0 && (
        <Field label="Choose the project to discuss">
          <select
            value={selectedId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {openProjects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title} · {p.zip}
              </option>
            ))}
          </select>
        </Field>
      )}
      {openDiscovery && !openProjects.length && (
        <Panel>
          <p>
            You can browse businesses now. Post a project to start a private
            chat about the work.
          </p>
          <button onClick={() => go("projects", "new")}>
            <Plus size={17} />
            Start a project
          </button>
        </Panel>
      )}
      {profiles.length > 0 && (
        <CollectionHeading
          title={
            page === "saved"
              ? "Saved businesses"
              : "Professionals for your home"
          }
          count={profiles.length}
        >
          View profiles, compare details and make a connection.
        </CollectionHeading>
      )}
      {profiles.length ? (
        <div className="pro-grid">
          {profiles.map((p) => {
            const match = openDiscovery
              ? p.discoverable && (!data.marketplacePreview || p.canRespond)
                ? selectedId
                : undefined
              : page === "saved"
                ? p.matchedProjectIds?.[0]
                : selectedId;
            return (
              <ProfessionalCard
                key={p.id}
                profile={p}
                preview={data.marketplacePreview && !p.canRespond}
                save={<SavePro proId={p.id} />}
                actions={
                  <>
                    {match && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const thread = await request(
                              "/projects/" + match + "/discussions/" + p.id,
                              {},
                            );
                            go("messages", thread.id);
                          }, "Conversation ready.")
                        }
                      >
                        <MessageCircle size={18} />
                        Chat with pro
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => go("pro", p.id)}
                    >
                      Full profile
                    </button>
                  </>
                }
              >
                <details className="card-hours">
                  <summary>
                    <CalendarDays size={15} /> View visit hours
                  </summary>
                  <Availability profile={p} />
                </details>
                {data.marketplacePreview && (
                  <details>
                    <summary>Business details</summary>
                    <dl>
                      {businessFields.map((field) =>
                        p.details?.[field.key] ? (
                          <div key={field.key}>
                            <dt>{field.label}</dt>
                            <dd>{p.details[field.key]}</dd>
                          </div>
                        ) : null,
                      )}
                      <dt>Base ZIP code</dt>
                      <dd>{p.zip}</dd>
                      <dt>Service radius</dt>
                      <dd>{p.serviceRadiusMiles} miles</dd>
                    </dl>
                    {p.images
                      ?.filter((i) => i.slot !== "cover" && i.slot !== "logo")
                      .map((i) => (
                        <img
                          key={i.id}
                          src={i.url}
                          alt={p.business + " portfolio"}
                          loading="lazy"
                          style={{ maxWidth: "100%" }}
                        />
                      ))}
                  </details>
                )}
              </ProfessionalCard>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            page === "saved"
              ? "No saved professionals yet."
              : data.marketplacePreview
                ? "No business profiles yet."
                : openDiscovery
                  ? "No available professionals yet."
                  : openProjects.length
                    ? "No matching professionals yet."
                    : "Start a project to receive matches."
          }
        >
          {page === "saved"
            ? "Save a professional to find their profile here."
            : data.marketplacePreview
              ? "No business profiles have been saved yet. A professional needs to save their business profile before it can appear here."
              : openDiscovery
                ? "Businesses appear once approved, verified, subscribed, and available. Check back as more professionals join. No sample profiles are shown."
                : openProjects.length
                  ? "Eligible professionals will appear here as they become available in your area."
                  : "Describe the work and choose its address. We will match nearby professionals."}
          <button onClick={() => go("projects", "new")}>
            <Plus size={17} />
            Start a project
          </button>
        </Empty>
      )}
    </>
  );
}
function ProProfile() {
  const { data, id, go } = useWorkspace();
  const openDiscovery = data.discoveryMode === "open";
  const p = data.profiles.find((x) => x.id === id);
  const [projectId, setProjectId] = useState("");
  if (!p)
    return (
      <>
        <Head title="Professional profile" />
        <Empty title="This professional is not available.">
          The profile may have been removed or is not visible to your account
          right now.
          <button onClick={() => go("discover")}>
            <Search size={17} />
            Browse professionals
          </button>
        </Empty>
      </>
    );
  const openProjects = data.projects.filter(
    (x) => !x.proId && ["requested", "quoted"].includes(x.status),
  );
  const selectedId = openProjects.some((x) => x.id === projectId)
    ? projectId
    : openProjects[0]?.id;
  const match =
    data.user.role === "customer"
      ? openDiscovery
        ? p.discoverable && (!data.marketplacePreview || p.canRespond)
          ? selectedId
          : undefined
        : p.matchedProjectIds?.includes(selectedId)
          ? selectedId
          : undefined
      : undefined;
  return (
    <>
      <div className="profile-page-toolbar">
        <button className="secondary" onClick={() => go("discover")}>
          <Search size={17} /> Back to professionals
        </button>
        <SavePro proId={p.id} label />
      </div>
      {data.marketplacePreview && !p.canRespond && (
        <p className="business-tip">
          Development preview: this business is still completing its setup. Chat
          and estimates open up once setup is finished.
        </p>
      )}
      <BusinessDisplay
        profile={p}
        actions={
          data.user.role === "customer" ? (
            <>
              {match && openProjects.length > 1 && (
                <Field label="Project to discuss">
                  <select
                    value={selectedId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    {openProjects.map((x) => (
                      <option value={x.id} key={x.id}>
                        {x.title} · {x.zip}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {match ? (
                <ChatWithPro projectId={match} proId={p.id} secondary={false} />
              ) : p.canRespond === false ? (
                <p className="business-tip">
                  This business is completing its setup. Messaging will be
                  available when it is ready.
                </p>
              ) : (
                <>
                  <p>
                    Start a project to discuss the work with this professional.
                  </p>
                  <button onClick={() => go("projects", "new")}>
                    <Plus size={17} /> Start a project
                  </button>
                </>
              )}
              <small className="muted">
                Chat, audio and video calls are available in your project
                conversation.
              </small>
            </>
          ) : undefined
        }
      />
    </>
  );
}
function UploadPreview({ file }: { file: UploadFile }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl("");
    setFailed(false);
    request<{ url: string }>("/uploads/" + file.id)
      .then((r) => {
        if (active) setUrl(r.url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [file.id]);
  if (failed)
    return (
      <span className="upload-preview">
        {file.name} could not be loaded right now.
      </span>
    );
  if (!url) return <span className="upload-preview">Loading {file.name}…</span>;
  return (
    <a
      className="upload-preview"
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        e.preventDefault();
        void request<{ url: string }>("/uploads/" + file.id)
          .then((r) => openExternal(r.url))
          .catch(() => {});
      }}
    >
      <img src={url} alt={file.name} loading="lazy" />
    </a>
  );
}
function Projects() {
  const { data, page, id, run, busy, go } = useWorkspace();
  const selectedProfessional = data.profiles.find((p) => p.id === id);
  const requestedCategory = new URLSearchParams(window.location.search).get(
    "category",
  );
  const initialCategory = (selectedProfessional?.category ||
    (categories.includes(requestedCategory as ServiceCategory)
      ? requestedCategory
      : null) ||
    categories[0]) as ServiceCategory;
  const [creating, setCreating] = useState(!!id),
    [projectCategory, setProjectCategory] =
      useState<ServiceCategory>(initialCategory);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any> | null>(
    null,
  );
  const initial = formValues || draft;
  const [pendingProject, setPendingProject] = useState<Record<
    string,
    any
  > | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const source =
    page === "leads"
      ? data.leads
      : data.projects.filter((p) => !!p.archived === showArchived);
  useEffect(() => {
    if (data.user.role !== "customer") return;
    void request<{ payload: Record<string, any> | null }>("/project-draft")
      .then((result) => {
        setDraft(result.payload);
        if (!selectedProfessional && result.payload?.category)
          setProjectCategory(result.payload.category as ServiceCategory);
      })
      .catch(() => undefined);
  }, [data.user.id, selectedProfessional?.id]);
  const payloadFrom = (f: FormData) => ({
    title: String(f.get("title") || ""),
    description: String(f.get("description") || ""),
    category: projectCategory,
    intake: Object.fromEntries(
      questionsFor(projectCategory).map((question) => [
        question.id,
        String(f.get("intake_" + question.id) || "").trim(),
      ]),
    ),
    address: String(f.get("address") || ""),
    placeId: String(f.get("placeId") || ""),
    addressUnit: String(f.get("addressUnit") || ""),
    urgency: String(f.get("urgency") || "flexible"),
    propertyType: String(f.get("propertyType") || "home"),
    budgetMin: f.get("budgetMin")
      ? Math.round(Number(f.get("budgetMin")) * 100)
      : null,
    budgetMax: f.get("budgetMax")
      ? Math.round(Number(f.get("budgetMax")) * 100)
      : null,
    proId: selectedProfessional?.id || null,
    scheduledAt: f.get("scheduledAt")
      ? new Date(String(f.get("scheduledAt"))).toISOString()
      : null,
  });
  const publish = (payload: Record<string, any>) => {
    let createdId = "";
    return run(
      async () => {
        const result = savedProjectId
          ? { id: savedProjectId }
          : await request("/projects", payload);
        setSavedProjectId(result.id);
        createdId = result.id;
        try {
          for (let index = 0; index < photos.length; index++) {
            setUploadProgress(
              `Uploading photo ${index + 1} of ${photos.length}…`,
            );
            await sendProjectPhoto(result.id, photos[index]);
          }
        } catch (error) {
          setUploadProgress(
            "Your project is saved. Some photos could not be uploaded. Retry below, or open your project to continue later.",
          );
          throw error;
        }
        await request("/project-draft", undefined, "DELETE").catch(
          () => undefined,
        );
        setDraft(null);
        setUploadProgress("");
        setCreating(false);
        setPendingProject(null);
        setFormValues(null);
        setSavedProjectId(null);
        setPhotos([]);
      },
      "Project published. Matching professionals have been notified.",
      () => go("project", createdId),
    );
  };
  return (
    <>
      <Head
        title={
          page === "leads"
            ? data.discoveryMode === "open"
              ? "Open projects"
              : "Projects matched for you"
            : data.user.role === "pro"
              ? "Manage your projects"
              : "Your home projects"
        }
        action={
          data.user.role === "customer" ? (
            <button
              disabled={busy || !!savedProjectId}
              onClick={() => {
                setPhotos([]);
                setCreating(!creating);
              }}
            >
              <Plus size={17} />
              New project
            </button>
          ) : undefined
        }
      >
        {page === "leads"
          ? data.marketplacePreview
            ? "Development preview: browse all open projects across services and locations, even while your business setup is incomplete. Private addresses stay hidden."
            : data.discoveryMode === "open"
              ? "Browse the latest 100 open projects across all services and locations. Your project alerts still follow your preferences. Confirm the scope and travel distance before responding."
              : "New projects match your service preferences. Requests with your pending estimate stay here so you can manage your response."
          : "Requests, estimates, and updates stay together."}
      </Head>
      {page !== "leads" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived projects
        </label>
      )}
      {creating && data.user.role === "customer" && (
        <Panel title="Tell us about your project">
          <p className="project-form-intro">
            A few specific details help professionals understand the work and
            send a more accurate estimate. Complete every required question
            before sending your request.
            {selectedProfessional && (
              <strong>
                {" "}
                This request will be sent to {selectedProfessional.business}.
              </strong>
            )}
          </p>
          {pendingProject ? (
            <section
              className="intake-summary"
              aria-label="Review project request"
            >
              <h3>Review before publishing</h3>
              <h4>{pendingProject.title}</h4>
              <p>{pendingProject.description}</p>
              <dl>
                <div>
                  <dt>Service</dt>
                  <dd>{pendingProject.category}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {pendingProject.address} {pendingProject.addressUnit}
                  </dd>
                </div>
                <div>
                  <dt>Timing</dt>
                  <dd>{pendingProject.urgency.replace("_", " ")}</dd>
                </div>
                <div>
                  <dt>Property</dt>
                  <dd>{pendingProject.propertyType}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>
                    {pendingProject.budgetMin === null &&
                    pendingProject.budgetMax === null
                      ? "Not specified"
                      : `${pendingProject.budgetMin === null ? "Any" : money(pendingProject.budgetMin)} – ${pendingProject.budgetMax === null ? "Any" : money(pendingProject.budgetMax)}`}
                  </dd>
                </div>
                <div>
                  <dt>Photos</dt>
                  <dd>{photos.length} selected</dd>
                </div>
                {Object.entries(pendingProject.intake).map(([key, value]) => (
                  <div key={key}>
                    <dt>{questionLabel(pendingProject.category, key)}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
              <p role="status" aria-live="polite">
                {busy && !uploadProgress
                  ? "Publishing your project…"
                  : uploadProgress}
              </p>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() => void publish(pendingProject)}
                >
                  {savedProjectId
                    ? "Retry remaining photos"
                    : "Publish project request"}
                </button>
                {savedProjectId ? (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => go("project", savedProjectId)}
                  >
                    Open saved project
                  </button>
                ) : (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setPendingProject(null)}
                  >
                    Back to edit
                  </button>
                )}
              </div>
            </section>
          ) : (
            <Form
              key={initial ? JSON.stringify(initial) : "new-project"}
              busy={busy}
              onSubmit={(f) => {
                const payload = payloadFrom(f);
                if (f.get("intent") === "draft")
                  return run(async () => {
                    await request("/project-draft", payload, "PUT");
                    setFormValues(null);
                    setDraft(payload);
                  }, "Draft saved. You can continue it from any signed-in device.");
                setFormValues(payload);
                setPendingProject(payload);
                return Promise.resolve();
              }}
            >
              <fieldset
                disabled={!!savedProjectId}
                className="project-details-fields"
              >
                <h3>1. Describe your project</h3>
                <p>Fields are required unless marked optional.</p>
                <div className="form-grid">
                  <Field label="Project title">
                    <input
                      name="title"
                      defaultValue={initial?.title || ""}
                      placeholder="For example, repair a leaking kitchen faucet"
                      required
                      minLength={5}
                      maxLength={120}
                    />
                  </Field>
                  <Field label="Service">
                    <select
                      name="category"
                      value={projectCategory}
                      disabled={!!selectedProfessional}
                      onChange={(event) =>
                        setProjectCategory(
                          event.target.value as ServiceCategory,
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <AddressAutocomplete
                    label="Full service address"
                    defaultAddress={initial?.address || ""}
                    defaultPlaceId={initial?.placeId || ""}
                  />
                  <Field label="Apartment / unit (optional)">
                    <input
                      name="addressUnit"
                      maxLength={100}
                      defaultValue={initial?.addressUnit || ""}
                    />
                  </Field>
                  <Field label="How soon do you need help?">
                    <select
                      name="urgency"
                      defaultValue={initial?.urgency || "flexible"}
                    >
                      <option value="urgent">As soon as possible</option>
                      <option value="this_week">This week</option>
                      <option value="this_month">This month</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </Field>
                  <Field label="Property type">
                    <select
                      name="propertyType"
                      defaultValue={initial?.propertyType || "home"}
                    >
                      <option value="home">House</option>
                      <option value="apartment">Apartment</option>
                      <option value="condo">Condo</option>
                      <option value="commercial">Commercial property</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Budget minimum (optional)">
                    <input
                      name="budgetMin"
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      defaultValue={
                        initial?.budgetMin == null
                          ? ""
                          : initial.budgetMin / 100
                      }
                    />
                  </Field>
                  <Field label="Budget maximum (optional)">
                    <input
                      name="budgetMax"
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      defaultValue={
                        initial?.budgetMax == null
                          ? ""
                          : initial.budgetMax / 100
                      }
                    />
                  </Field>
                </div>
                <Field label="What needs to be done?">
                  <textarea
                    name="description"
                    defaultValue={initial?.description || ""}
                    required
                    minLength={20}
                    maxLength={4000}
                    rows={4}
                    placeholder="Describe the problem, where it is, and what you would like done (at least 20 characters)."
                  />
                </Field>
                <section className="project-questionnaire">
                  <div className="questionnaire-heading">
                    <span className="category-icon">
                      <ServiceIcon service={projectCategory} size={21} />
                    </span>
                    <div>
                      <h3>2. {projectCategory} details</h3>
                      <p>
                        These answers help professionals assess the job before
                        contacting you.
                      </p>
                    </div>
                  </div>
                  {(projectCategory === "Plumbing" ||
                    projectCategory === "Electrical") && (
                    <p className="safety-note" role="note">
                      If there is immediate danger, fire, flooding, gas, or
                      exposed live wiring, leave the area and contact emergency
                      services or the appropriate utility. Aplime is not an
                      emergency service.
                    </p>
                  )}
                  <div className="questionnaire-grid">
                    {questionsFor(projectCategory).map((question) => (
                      <Field
                        label={question.label}
                        key={projectCategory + ":" + question.id}
                      >
                        {question.type === "select" ? (
                          <select
                            name={"intake_" + question.id}
                            required={question.required}
                            defaultValue={initial?.intake?.[question.id] || ""}
                          >
                            <option value="" disabled>
                              Select an answer
                            </option>
                            {question.options?.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        ) : question.type === "textarea" ? (
                          <textarea
                            name={"intake_" + question.id}
                            required={question.required}
                            minLength={question.required ? 3 : undefined}
                            maxLength={1500}
                            rows={3}
                            placeholder={question.placeholder}
                            defaultValue={initial?.intake?.[question.id] || ""}
                          />
                        ) : (
                          <input
                            name={"intake_" + question.id}
                            required={question.required}
                            minLength={question.required ? 2 : undefined}
                            maxLength={1500}
                            placeholder={question.placeholder}
                            defaultValue={initial?.intake?.[question.id] || ""}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </section>
              </fieldset>
              <ProjectPhotos
                photos={photos}
                onChange={setPhotos}
                disabled={busy || !!savedProjectId}
              />
              <div className="project-submit">
                <p>
                  Review your request before publishing. Publishing does not
                  confirm an appointment or make a payment.
                </p>
                <p role="status" aria-live="polite">
                  {uploadProgress}
                </p>
                <div className="actions">
                  <button name="intent" value="review">
                    {busy
                      ? "Saving your project…"
                      : savedProjectId
                        ? "Retry remaining photos"
                        : "Review project request"}
                  </button>
                  {!savedProjectId && (
                    <button
                      name="intent"
                      value="draft"
                      formNoValidate
                      className="secondary"
                    >
                      Save draft
                    </button>
                  )}
                  {savedProjectId && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => go("project", savedProjectId)}
                    >
                      Open saved project
                    </button>
                  )}
                  {!savedProjectId && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setPhotos([]);
                        setFormValues(null);
                        setCreating(false);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </Form>
          )}
        </Panel>
      )}
      {page === "leads" && (
        <button className="secondary" onClick={() => go("availability")}>
          Edit project preferences
        </button>
      )}
      {page === "leads" && !!data.discoveryRequirements?.length && (
        <Panel title="Get ready to respond to projects">
          <ul>
            {data.discoveryRequirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="actions">
            <button onClick={() => go("profile")}>Business profile</button>
            <button className="secondary" onClick={() => go("subscription")}>
              Subscription & verification
            </button>
          </div>
        </Panel>
      )}
      <section className="project-collection" aria-label="Projects">
        <CollectionHeading
          title={
            page === "leads"
              ? "Available projects"
              : showArchived
                ? "Archived projects"
                : "Your projects"
          }
          count={source.length}
        >
          Open a card to see details and next steps.
        </CollectionHeading>
        {page === "leads" && !source.length ? (
          <Empty title="No open projects to show">
            {data.marketplacePreview
              ? "No unassigned open projects are available. Paused, booked, and closed projects are excluded."
              : data.discoveryRequirements?.length
                ? "Complete the steps above to receive new opportunities."
                : data.discoveryMode === "open"
                  ? "New customer projects will appear here when posted. Booked, paused, and closed projects are excluded."
                  : "New projects will appear when they match your service categories and area. You can update your preferences above."}
          </Empty>
        ) : (
          <ProjectList projects={source} />
        )}
      </section>
    </>
  );
}
function ProjectDetail() {
  const { data, id, run, busy, go } = useWorkspace();
  const p = [...data.projects, ...data.leads].find((p) => p.id === id);
  const [action, setAction] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setAction("");
  }, [id, p?.version]);
  useEffect(() => {
    setEditing(false);
  }, [id]);
  if (!p)
    return (
      <Empty title="Project unavailable.">
        You may not have access to this project.
      </Empty>
    );
  const customer = p.customerId === data.user.id,
    pro = p.proId === data.user.id;
  const own = customer || pro;
  const quotes = data.quotes.filter((q) => q.projectId === p.id);
  const open = ["requested", "quoted"].includes(p.status);
  const ownProfile = data.profiles.find((x) => x.id === data.user.id);
  const canQuote =
    !!ownProfile &&
    ownProfile.verified &&
    !ownProfile.suspended &&
    ownProfile.available &&
    (ownProfile.reviewStatus === "approved" || ownProfile.listed);
  const previewBlocked =
    !!data.marketplacePreview && !!data.discoveryRequirements?.length;
  const ownQuote = quotes.find((q) => q.proId === data.user.id);
  const sharedPhotos = own
    ? []
    : data.uploads.filter((f) => f.projectId === p.id && f.status === "ready");
  const submit = (body: unknown) =>
    request("/projects/" + p.id + "/actions", {
      ...(body as object),
      expectedVersion: p.version,
    });
  return (
    <>
      <Head
        title={p.title}
        action={<Badge>{p.status.replace("_", " ")}</Badge>}
      >
        {p.category} · {p.zip}
      </Head>
      {data.marketplacePreview &&
        data.user.role === "pro" &&
        !!data.discoveryRequirements?.length && (
          <Panel title="Project preview">
            <p>
              You can view this project now. Complete your business setup to
              start a conversation or send an estimate.
            </p>
            <ul>
              {data.discoveryRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button onClick={() => go("profile")}>
              Complete business setup
            </button>
          </Panel>
        )}
      <section className="project-next-step" aria-label="Your next step">
        <div>
          <small>YOUR NEXT STEP</small>
          <h2>
            {p.status === "paused"
              ? "Agree on the next step before resuming"
              : p.cancellationRequestedBy
                ? "Respond to the cancellation request"
                : p.completionRequested
                  ? (p.completionRequestedBy || p.proId) !== data.user.id
                    ? "Review the completed work"
                    : "Waiting for the other participant to confirm"
                  : p.status === "requested"
                    ? customer
                      ? "Discuss your request with professionals"
                      : "Ask a question or prepare an estimate"
                    : p.status === "quoted"
                      ? customer
                        ? "Compare estimates and choose your professional"
                        : "Answer questions and keep your estimate up to date"
                      : p.status === "booked" && p.awardAccepted === false
                        ? pro
                          ? "Confirm you can take this job"
                          : "Waiting for the professional to confirm the job"
                        : p.status === "booked"
                          ? "Agree on the appointment and prepare for work"
                          : p.status === "in_progress"
                            ? "Keep each other updated as work progresses"
                            : p.status === "completed"
                              ? customer
                                ? "Work completed — share your experience"
                                : "Work completed"
                              : p.status === "cancelled"
                                ? "This project was cancelled"
                                : p.status === "disputed"
                                  ? "Our team is reviewing the reported issue"
                                  : "Check your project status and support updates"}
          </h2>
          <p>
            Service payments are arranged directly. Aplime charges professionals
            only for their subscription.
          </p>
          {customer && p.status === "completed" && (
            <button onClick={() => go("reviews")}>Leave a review</button>
          )}
        </div>
        {!["cancelled", "disputed"].includes(p.status) && (
          <ol className="project-journey">
            {["Request", "Discuss & compare", "Booked", "Work", "Review"].map(
              (label, index) => (
                <li
                  key={label}
                  className={
                    index <=
                    [
                      "requested",
                      "quoted",
                      "booked",
                      "in_progress",
                      "completed",
                    ].indexOf(
                      p.status === "paused"
                        ? p.pausedFrom || "requested"
                        : p.status,
                    )
                      ? "reached"
                      : ""
                  }
                >
                  {label}
                </li>
              ),
            )}
          </ol>
        )}
      </section>
      <ProjectActionBar
        project={p}
        canRespond={canQuote && !previewBlocked}
        hasEstimates={quotes.some((q) => q.status === "pending")}
        hasOwnEstimate={!!ownQuote && ownQuote.status === "pending"}
        onPropose={() => {
          setAction("reschedule");
          jumpTo("project-details");
        }}
        onEdit={() => setEditing(true)}
      />
      {editing && customer && (
        <EditDetails
          project={p}
          submit={submit}
          onDone={() => setEditing(false)}
        />
      )}
      {customer && p.proId && open && (
        <Panel title="Waiting on your chosen professional">
          <p>
            This request was sent to {p.proName || "one professional"} only. If
            they are slow to answer or you want to compare options, open it to
            every matching professional. Estimates already received stay
            available.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "Open this request to all matching professionals?",
                )
              )
                return;
              void run(
                () => submit({ type: "open_request" }),
                "Your request is now open to matching professionals.",
              );
            }}
          >
            Open to all matching professionals
          </button>
        </Panel>
      )}
      {p.status === "booked" && p.awardAccepted === false && (
        <AwardResponse
          busy={busy}
          customer={customer}
          proName={p.proName}
          amount={p.amount}
          accept={() =>
            run(
              () => submit({ type: "accept_award" }),
              "Job confirmed. Agree on the appointment next.",
            )
          }
          decline={(reason) =>
            run(
              () => submit({ type: "decline_award", reason }),
              "You declined this job. The customer was notified.",
              () => go("leads"),
            )
          }
          withdraw={() =>
            run(
              () => submit({ type: "withdraw_award" }),
              "Award withdrawn. Your request is open for estimates again.",
            )
          }
        />
      )}
      {own &&
        p.proposedAt &&
        ["requested", "quoted", "booked"].includes(p.status) && (
          <Panel title="Appointment proposal">
            <p>
              {date(p.proposedAt)} —{" "}
              {p.proposedBy === data.user.id
                ? "Waiting for the other participant to confirm."
                : "Please confirm this time or decline to discuss another."}
            </p>
            <p>
              Your confirmed appointment changes only when the proposal is
              accepted.
            </p>
            {p.proposedBy !== data.user.id && (
              <div className="actions">
                {[true, false].map((accept) => (
                  <button
                    className={accept ? "" : "secondary"}
                    key={String(accept)}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          submit({
                            type: "respond_appointment",
                            proposedAt: p.proposedAt,
                            accept,
                          }),
                        accept
                          ? "Appointment confirmed."
                          : "Proposal declined.",
                      )
                    }
                  >
                    {accept ? "Confirm appointment" : "Decline proposal"}
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}
      <div className="two-columns">
        <div id="project-details">
          <Panel title="Project details">
            <p className="project-description">{p.description}</p>
            {p.intake && Object.keys(p.intake).length > 0 && (
              <section
                className="intake-summary"
                aria-labelledby="intake-title"
              >
                <h3 id="intake-title">Service questionnaire</h3>
                <dl>
                  {Object.entries(p.intake).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {questionLabel(p.category as ServiceCategory, key)}
                      </dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            <dl>
              <dt>Customer</dt>
              <dd>{p.customerName || "Private until booked"}</dd>
              <dt>Professional</dt>
              <dd>{p.proName || "Choosing the right fit"}</dd>
              {own && p.address && (
                <>
                  <dt>Service address</dt>
                  <dd>
                    {p.address} {p.addressUnit}
                  </dd>
                </>
              )}
              <dt>Appointment</dt>
              <dd>{date(p.scheduledAt)}</dd>
              <dt>Timing</dt>
              <dd>{p.urgency.replace("_", " ")}</dd>
              <dt>Property type</dt>
              <dd>{p.propertyType}</dd>
              <dt>Customer budget</dt>
              <dd>
                {p.budgetMin === null && p.budgetMax === null
                  ? "Not specified"
                  : `${p.budgetMin === null ? "Any" : money(p.budgetMin)} – ${p.budgetMax === null ? "Any" : money(p.budgetMax)}`}
              </dd>
              <dt>
                {p.amount
                  ? "Agreed total"
                  : ownQuote
                    ? "Your estimate"
                    : "Agreed total"}
              </dt>
              <dd>
                {p.amount
                  ? money(p.amount)
                  : ownQuote && ownQuote.status === "pending"
                    ? money(ownQuote.amount)
                    : "Awaiting an estimate"}
              </dd>
            </dl>
            {action && (
              <Form
                busy={busy}
                onSubmit={(f) =>
                  run(async () => {
                    await submit(
                      action === "reschedule"
                        ? {
                            type: action,
                            scheduledAt: new Date(
                              String(f.get("time")),
                            ).toISOString(),
                          }
                        : { type: action, reason: f.get("reason") },
                    );
                    setAction("");
                  }, "Project updated.")
                }
              >
                <h3>
                  {action === "reschedule"
                    ? "Propose an appointment"
                    : action === "cancel"
                      ? "Confirm cancellation"
                      : "Tell us what happened"}
                </h3>
                {action === "reschedule" &&
                  data.profiles.find((profile) => profile.id === p.proId) && (
                    <Availability
                      profile={data.profiles.find(
                        (profile) => profile.id === p.proId,
                      )!}
                    />
                  )}
                {action === "reschedule" ? (
                  <Field label="One-hour visit (your device time zone)">
                    <input name="time" type="datetime-local" required />
                  </Field>
                ) : (
                  <Field label="Reason">
                    <textarea
                      name="reason"
                      minLength={action === "cancel" ? 5 : 10}
                      maxLength={2000}
                      required
                    />
                  </Field>
                )}
                <button>Confirm {action}</button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAction("")}
                >
                  Keep current details
                </button>
              </Form>
            )}
          </Panel>
        </div>
        <div id="project-estimates">
          <Panel title="Estimates">
            {quotes.length ? (
              quotes.map((q) => (
                <article className="quote-item" key={q.id}>
                  <div>
                    <h3>{money(q.amount)}</h3>
                    <Badge>
                      {q.status === "pending" && !open
                        ? "on hold"
                        : q.status === "pending" &&
                            q.expiresAt &&
                            new Date(q.expiresAt).getTime() <= Date.now()
                          ? "expired"
                          : q.status}{" "}
                      · version {q.revision}
                    </Badge>
                  </div>
                  <p>
                    {data.profiles.find((p) => p.id === q.proId)?.business ||
                      "Professional"}
                  </p>
                  <p>{q.description}</p>
                  <dl>
                    <dt>Labor</dt>
                    <dd>{money(q.laborAmount)}</dd>
                    <dt>Materials</dt>
                    <dd>{money(q.materialsAmount)}</dd>
                    <dt>Expected timeline</dt>
                    <dd>{q.timeline}</dd>
                    <dt>Exclusions</dt>
                    <dd>{q.exclusions || "None listed"}</dd>
                    <dt>Valid until</dt>
                    <dd>{q.expiresAt ? date(q.expiresAt) : "No expiration"}</dd>
                  </dl>
                  {customer && (
                    <div className="actions">
                      {["pending", "accepted"].includes(q.status) && (
                        <ChatWithPro projectId={p.id} proId={q.proId} />
                      )}
                      <button
                        className="secondary"
                        onClick={() => go("pro", q.proId)}
                      >
                        View profile
                      </button>
                      <SavePro proId={q.proId} label />
                    </div>
                  )}
                  {customer && q.status === "pending" && open && (
                    <div className="actions">
                      {!(
                        q.expiresAt &&
                        new Date(q.expiresAt).getTime() <= Date.now()
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            const business =
                              data.profiles.find((x) => x.id === q.proId)
                                ?.business || "this professional";
                            if (
                              !window.confirm(
                                `Accept ${money(q.amount)} from ${business}? This professional must confirm the job. Your other estimates stay on hold until they do.`,
                              )
                            )
                              return;
                            void run(
                              () =>
                                submit({
                                  type: "accept",
                                  quoteId: q.id,
                                  revision: q.revision,
                                }),
                              "Estimate selected. The professional must confirm the job before work starts.",
                            );
                          }}
                        >
                          Accept estimate
                        </button>
                      )}
                      <button
                        disabled={busy}
                        className="secondary"
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
                  {data.user.role === "pro" &&
                    q.proId === data.user.id &&
                    q.status === "pending" &&
                    ["requested", "quoted"].includes(p.status) && (
                      <details>
                        <summary>Withdraw this estimate</summary>
                        <Form
                          busy={busy}
                          onSubmit={(f) =>
                            run(
                              () =>
                                submit({
                                  type: "withdraw_quote",
                                  reason: f.get("reason"),
                                }),
                              "Estimate withdrawn.",
                            )
                          }
                        >
                          <p>
                            The customer will be notified and cannot accept this
                            estimate. You can submit a new version while the
                            request remains open.
                          </p>
                          <Field label="Reason for withdrawing">
                            <textarea
                              name="reason"
                              required
                              minLength={5}
                              maxLength={1000}
                            />
                          </Field>
                          <button>Confirm withdrawal</button>
                        </Form>
                      </details>
                    )}
                </article>
              ))
            ) : (
              <Empty title="No estimates yet.">
                Your estimates will appear here.
              </Empty>
            )}
            {data.user.role === "pro" &&
              !previewBlocked &&
              open &&
              (!p.proId || pro) &&
              !canQuote && (
                <p className="project-state-note" role="note">
                  Your business profile must be approved, verified and set to
                  available before you can send estimates.{" "}
                  <button className="text-button" onClick={() => go("profile")}>
                    Review your profile
                  </button>
                </p>
              )}
            {data.user.role === "pro" &&
              !previewBlocked &&
              canQuote &&
              open &&
              (!p.proId || pro) &&
              !quotes.some(
                (q) =>
                  q.proId === data.user.id &&
                  !["pending", "withdrawn", "expired"].includes(q.status),
              ) && (
                <div id="estimate-form">
                  <Form
                    busy={busy}
                    onSubmit={(f) =>
                      run(
                        () =>
                          submit({
                            type: "quote",
                            laborAmount: Math.round(
                              Number(f.get("laborAmount")) * 100,
                            ),
                            materialsAmount: Math.round(
                              Number(f.get("materialsAmount")) * 100,
                            ),
                            description: f.get("description"),
                            exclusions: f.get("exclusions"),
                            timeline: f.get("timeline"),
                            expiresAt: f.get("expiresAt")
                              ? new Date(
                                  String(f.get("expiresAt")),
                                ).toISOString()
                              : null,
                          }),
                        ownQuote ? "Estimate updated." : "Estimate sent.",
                      )
                    }
                  >
                    <h3>
                      {quotes.some((q) => q.proId === data.user.id)
                        ? "Revise your estimate"
                        : "Send a priced estimate"}
                    </h3>
                    <p>
                      Explain the scope, exclusions, and expected timing.
                      Pending estimates can be updated before acceptance.
                    </p>
                    <Field label="Labor (USD)">
                      <input
                        key={
                          "labor-" +
                          quotes.find((q) => q.proId === data.user.id)?.revision
                        }
                        defaultValue={
                          quotes.find((q) => q.proId === data.user.id)
                            ? quotes.find((q) => q.proId === data.user.id)!
                                .laborAmount / 100
                            : undefined
                        }
                        type="number"
                        name="laborAmount"
                        min="0"
                        max="100000"
                        step=".01"
                        required
                      />
                    </Field>
                    <Field label="Materials and other costs (USD)">
                      <input
                        name="materialsAmount"
                        type="number"
                        min="0"
                        max="100000"
                        step=".01"
                        required
                        defaultValue={
                          quotes.find((q) => q.proId === data.user.id)
                            ?.materialsAmount
                            ? quotes.find((q) => q.proId === data.user.id)!
                                .materialsAmount / 100
                            : 0
                        }
                      />
                    </Field>
                    <Field label="Scope and inclusions">
                      <textarea
                        key={
                          "scope-" +
                          quotes.find((q) => q.proId === data.user.id)?.revision
                        }
                        defaultValue={
                          quotes.find((q) => q.proId === data.user.id)
                            ?.description
                        }
                        name="description"
                        minLength={10}
                        maxLength={2000}
                        required
                      />
                    </Field>
                    <Field label="Expected timeline">
                      <input
                        name="timeline"
                        minLength={3}
                        maxLength={300}
                        required
                        placeholder="For example, one workday after materials arrive"
                        defaultValue={
                          quotes.find((q) => q.proId === data.user.id)?.timeline
                        }
                      />
                    </Field>
                    <Field label="Exclusions (optional)">
                      <textarea
                        name="exclusions"
                        maxLength={2000}
                        placeholder="Anything the estimate does not include"
                        defaultValue={
                          quotes.find((q) => q.proId === data.user.id)
                            ?.exclusions
                        }
                      />
                    </Field>
                    <Field label="Estimate expiration (optional)">
                      <input name="expiresAt" type="datetime-local" />
                    </Field>
                    <button>
                      {ownQuote ? "Update estimate" : "Send estimate"}
                    </button>
                  </Form>
                </div>
              )}
          </Panel>
        </div>
      </div>
      {own && <ProjectControls key={p.id} project={p} />}
      <div id="project-chat">
        <Discussions
          projectId={p.id}
          canStart={
            data.user.role === "pro" &&
            !previewBlocked &&
            canQuote &&
            ["requested", "quoted"].includes(p.status) &&
            (!p.proId || pro)
          }
        />
      </div>
      {sharedPhotos.length > 0 && (
        <Panel title="Customer photos">
          <p>
            The customer shared these photos to help you prepare an accurate
            estimate.
          </p>
          <div className="upload-gallery">
            {sharedPhotos.map((f) => (
              <UploadPreview key={f.id} file={f} />
            ))}
          </div>
        </Panel>
      )}
      {own && (
        <Panel title="Project attachments">
          <p>
            Share up to 5 photos, or project documents. Do not upload identity
            documents here; use your business verification flow.
          </p>
          <Field label="Upload a photo or PDF (up to 10 MB)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    const r = await request("/projects/" + p.id + "/uploads", {
                      name: file.name,
                      contentType: file.type,
                      size: file.size,
                    });
                    const uploaded = await fetch(r.url, {
                      method: "PUT",
                      headers: { "Content-Type": file.type },
                      body: file,
                    });
                    if (!uploaded.ok)
                      throw new Error(
                        `The file could not be uploaded (storage responded ${uploaded.status}). Please retry.`,
                      );
                    await request("/uploads/" + r.id + "/complete", {});
                  }, "File uploaded.");
              }}
            />
          </Field>
          <div className="upload-gallery">
            {data.uploads
              .filter(
                (f) =>
                  f.projectId === p.id &&
                  f.status === "ready" &&
                  f.contentType.startsWith("image/"),
              )
              .map((f) => (
                <UploadPreview key={f.id} file={f} />
              ))}
          </div>
          {data.uploads
            .filter(
              (f) =>
                f.projectId === p.id &&
                (f.status === "pending" || !f.contentType.startsWith("image/")),
            )
            .map((f) => (
              <button
                key={f.id}
                className="secondary"
                onClick={() =>
                  void run(async () => {
                    if (f.status === "pending") {
                      await request("/uploads/" + f.id, undefined, "DELETE");
                    } else {
                      const r = await request("/uploads/" + f.id);
                      await openExternal(r.url);
                    }
                  }, "")
                }
              >
                {f.status === "pending" ? "Remove unfinished upload: " : ""}
                {f.name}
              </button>
            ))}
        </Panel>
      )}
    </>
  );
}
function Quotes() {
  const { data, go } = useWorkspace();
  return (
    <>
      <Head title="Clear estimates. Great beginnings.">
        Review scope and price before booking.
      </Head>
      <Panel>
        {data.quotes.length ? (
          data.quotes.map((q) => (
            <button
              className="project-row"
              key={q.id}
              disabled={
                !data.projects.some((p) => p.id === q.projectId) &&
                !data.leads.some((p) => p.id === q.projectId)
              }
              onClick={() => go("project", q.projectId)}
            >
              <span>
                <strong>
                  {data.projects.find((p) => p.id === q.projectId)?.title ||
                    data.leads.find((p) => p.id === q.projectId)?.title ||
                    q.projectTitle ||
                    "Project estimate"}
                </strong>
                <small>{q.description}</small>
              </span>
              <strong>{money(q.amount)}</strong>
              <Badge>
                {q.status} · version {q.revision}
              </Badge>
            </button>
          ))
        ) : (
          <Empty title="No estimates yet.">
            Start a project or respond to an opportunity.
          </Empty>
        )}
      </Panel>
    </>
  );
}
function Schedule() {
  const { data } = useWorkspace();
  return (
    <>
      <Head title="A little structure for a busy week.">
        Appointment times are shown in your current device timezone.
      </Head>
      {data.user.role === "pro" &&
        data.profiles.find((p) => p.id === data.user.id) && (
          <Panel>
            <Availability
              profile={data.profiles.find((p) => p.id === data.user.id)!}
            />
          </Panel>
        )}
      <Panel title="Upcoming appointments">
        <ProjectList
          compact
          projects={data.projects
            .filter(
              (p) =>
                p.scheduledAt && ["booked", "in_progress"].includes(p.status),
            )
            .sort(
              (a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!),
            )}
        />
      </Panel>
    </>
  );
}
function Messages() {
  return (
    <>
      <Head title="Your conversations">
        Project chats and Aplime support, together in one inbox.
      </Head>
      <MessagesInbox />
    </>
  );
}
function Reviews() {
  const { data, run, busy } = useWorkspace();
  const ready = data.projects.filter(
    (p) =>
      p.status === "completed" &&
      data.user.id === p.customerId &&
      !data.reviews.some((x) => x.projectId === p.id),
  );
  return (
    <>
      <Head title="Your experience matters.">
        Thoughtful feedback helps the community make better choices.
      </Head>
      {ready.map((p) => (
        <Panel title={"Review " + p.title} key={p.id}>
          <Form
            busy={busy}
            onSubmit={(f) =>
              run(
                () =>
                  request("/projects/" + p.id + "/review", {
                    rating: Number(f.get("rating")),
                    body: f.get("body"),
                  }),
                "Review published.",
              )
            }
          >
            <Field label="Rating">
              <select name="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option value={n} key={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How did it go?">
              <textarea name="body" minLength={10} maxLength={2000} required />
            </Field>
            <button>Publish review</button>
          </Form>
        </Panel>
      ))}
      <Panel title="Reviews">
        {data.reviews.length ? (
          data.reviews.map((r) => (
            <article className="review" key={r.id}>
              <strong>{r.rating} / 5 stars</strong>
              <p>{r.body}</p>
              {r.reply ? (
                <blockquote>{r.reply}</blockquote>
              ) : (
                r.proId === data.user.id && (
                  <Form
                    busy={busy}
                    onSubmit={(f) =>
                      run(
                        () =>
                          request("/reviews/" + r.id + "/reply", {
                            reply: f.get("reply"),
                          }),
                        "Reply published.",
                      )
                    }
                  >
                    <Field label="Your reply">
                      <textarea
                        name="reply"
                        minLength={2}
                        maxLength={1500}
                        required
                      />
                    </Field>
                    <button>Reply</button>
                  </Form>
                )
              )}
            </article>
          ))
        ) : (
          <Empty title="No reviews yet.">
            Reviews are available after completed projects.
          </Empty>
        )}
      </Panel>
    </>
  );
}
function Business() {
  return <BusinessProfile />;
}
function CreditIcon() {
  return <CheckCircle2 />;
}
function Notifications() {
  const { data, run, busy, go } = useWorkspace();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notices = data.notices.filter((n) => !unreadOnly || !n.read);
  return (
    <>
      <Head
        title="Notifications"
        action={
          <button
            className="secondary"
            disabled={busy || !data.unreadCount}
            onClick={() =>
              void run(() => request("/notifications/read", {}), "")
            }
          >
            Mark all read
          </button>
        }
      >
        Your project, conversation, and account updates. {data.unreadCount || 0}{" "}
        unread.
      </Head>
      <label className="notification-filter">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
        />{" "}
        Show unread only
      </label>
      <Panel>
        {notices.length ? (
          notices.map((n) => (
            <article
              className={n.read ? "notice-item" : "notice-item unread"}
              key={n.id}
            >
              <Badge>{n.read ? "Read" : "New"}</Badge>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{date(n.createdAt)}</small>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    void run(
                      () => request(`/notifications/${n.id}/read`, {}),
                      "",
                    );
                    go(
                      n.targetPage || "notifications",
                      n.targetId || undefined,
                    );
                  }}
                >
                  View update
                </button>
                {!n.read && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => request(`/notifications/${n.id}/read`, {}),
                        "",
                      )
                    }
                  >
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty
            title={
              unreadOnly ? "No unread notifications" : "No notifications yet"
            }
          />
        )}
        <p>
          Showing your latest 100 notifications. Older unread updates are
          included in the badge count.
        </p>
      </Panel>
    </>
  );
}
function Settings() {
  const { data, run, busy } = useWorkspace();
  return (
    <>
      <Head title="Make yourself at home.">
        Manage your account preferences.
      </Head>
      <Panel title="Account details">
        <Form
          busy={busy}
          onSubmit={(f) =>
            run(() =>
              request(
                "/account",
                {
                  name: f.get("name"),
                  emailAlerts: f.get("emailAlerts") === "on",
                },
                "PUT",
              ),
            )
          }
        >
          <Field label="Your name">
            <input
              name="name"
              defaultValue={data.user.name}
              minLength={2}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Email">
            <input value={data.user.email} disabled />
          </Field>
          <label className="checkbox">
            <input
              name="emailAlerts"
              type="checkbox"
              defaultChecked={data.user.settings.emailAlerts !== false}
            />
            Email me about project updates
          </label>
          <button>Save preferences</button>
        </Form>
      </Panel>
      <Panel title="Blocked conversations">
        {data.blocked.length ? (
          data.blocked.map((id) => (
            <div className="payment-row" key={id}>
              <span>
                {data.profiles.find((p) => p.id === id)?.name ||
                  "Project participant"}
              </span>
              <button
                className="secondary"
                onClick={() =>
                  void run(() => request("/blocked/" + id, { blocked: false }))
                }
              >
                Unblock
              </button>
            </div>
          ))
        ) : (
          <p>No blocked conversations.</p>
        )}
      </Panel>
      <Panel title="Account and data requests">
        <p>
          Use Help & safety to request account deletion, a data export, or help
          with your account. Requests are reviewed by support.
        </p>
        <a href="/app/help">Contact support →</a>
      </Panel>
    </>
  );
}
function Support() {
  const { id } = useWorkspace();
  return (
    <>
      <Head title="Help & safety">
        Contact Aplime about your account or a project. For emergencies, contact
        local emergency services.
      </Head>
      <MessagesInbox legacySupportId={id} />
    </>
  );
}
