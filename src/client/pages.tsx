import { ReviewPhotoEditor } from "./review-photos.js";
import { ProjectContact } from "./project-contact.js";
import { RatingPicker, ReviewCard } from "./reviews.js";
import { T, LanguageSelect } from "../shared/language.js";
import { ProjectIntake } from "./project-intake.js";
import { OpportunityResponse } from "./opportunity-response.js";
import { EstimateForm } from "./estimate-form.js";
import { emailCategories } from "../shared/email-alerts.js";
import { quotePrice, quoteTiming } from "../shared/estimates.js";
import { ProfessionalActions } from "./professional-actions.js";
import { CallMeetings } from "./call-meetings.js";
import { ProjectPhotoGallery } from "./project-photo-gallery.js";
import {
  CustomerProjectHeader,
  CustomerProjectDetails,
} from "./project-presentation.js";
import { CustomerDashboard } from "./customer-dashboard.js";
import { ProDashboard } from "./pro-dashboard.js";
import { ProjectProfessionals } from "./project-professionals.js";
import { SetupNotice } from "./setup-notice.js";
import { ProjectCard, ProfessionalCard } from "./marketplace-cards.js";
import { Subscription } from "./subscription.js";
import { MessagesInbox } from "./messages.js";
import { BusinessNavigation } from "./business-navigation.js";
import { AwardResponse } from "./award-response.js";
import { ProjectControls } from "./project-controls.js";
import { Preferences } from "./preferences.js";
import { AccountData } from "./account-data.js";
import { Availability } from "./availability.js";
import { BusinessProfile } from "./business-profile.js";
import { IdentityVerification } from "./identity-verification.js";
import { BusinessDisplay } from "./business-display.js";
import {
  ProjectActionBar,
  EditDetails,
  SavePro,
  ChatWithPro,
  jumpTo,
} from "./project-actions.js";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  MessageCircle,
  Plus,
  Search,
  CheckCircle2,
  Upload,
  Phone,
  Video,
} from "lucide-react";
import {
  categories,
  money,
  type Project,
  type Profile,
} from "../shared/domain.js";
import {
  questionLabel,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Empty, Head, Panel, Badge, Field, Form } from "./ui.js";
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
  const { page, id, data } = useWorkspace();
  if (
    data.user.role === "pro" &&
    ["leads", "projects", "quotes"].includes(page)
  )
    return <ProDashboard />;
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
      return <Projects key={page + ":" + (id || "list")} />;
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
      return <Dashboard />;
    case "settings":
      return <Settings />;
    case "help":
      return <Support />;
    default:
      return (
        <>
          <Head title={<T>{"Page not found."}</T>} />
          <Empty>Choose a page from your navigation.</Empty>
        </>
      );
  }
}
function ProjectList({ projects }: { projects: Project[] }) {
  const { data, go } = useWorkspace();
  return projects.length ? (
    <div className="project-card-grid">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          quotes={data.quotes}
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
  const { data } = useWorkspace();
  return data.user.role === "pro" ? <ProDashboard /> : <CustomerDashboard />;
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
  const eligibleProfiles = data.profiles.filter((p) =>
    page === "saved"
      ? data.saved.includes(p.id)
      : openDiscovery
        ? p.discoverable
        : p.matchedProjectIds?.includes(selectedId),
  );
  const profiles = eligibleProfiles;
  return (
    <section
      className={
        "directory-page" + (page === "saved" ? " saved-professionals-page" : "")
      }
      aria-label={
        page === "saved" ? "Saved professionals" : "Professional directory"
      }
    >
      <div className="directory-intro">
        <Head
          title={
            page === "saved" ? (
              "Your saved professionals"
            ) : openDiscovery ? (
              <>
                <T>{"Find professionals"}</T>{" "}
                <em>
                  <T>{"for your home."}</T>
                </em>
              </>
            ) : (
              "Your project matches"
            )
          }
        >
          {page === "saved"
            ? "Keep trusted professionals close."
            : openDiscovery
              ? "Find a business for your next home project."
              : "Professionals matched to your project and location."}
        </Head>
        <div className="directory-art" aria-hidden="true">
          <img src="/aplime-garden.webp" alt="" width="1536" height="1024" />
          <span>
            Better homes.
            <br />
            Brighter days.
          </span>
        </div>
      </div>
      {page !== "saved" && openProjects.length > 0 && (
        <div className="directory-project-context">
          <Field label="Project to discuss">
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
        </div>
      )}
      {page !== "saved" && openDiscovery && !openProjects.length && (
        <div className="inline-next-action">
          <p>
            Have a project in mind?{" "}
            <strong>
              <T>{"Start a request to chat with a pro."}</T>
            </strong>
          </p>
          <button onClick={() => go("projects", "new")}>
            <Plus size={17} /> <T>{"Start a project"}</T>{" "}
          </button>
        </div>
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
                layout={page === "saved" ? "horizontal" : "vertical"}
                preview={data.marketplacePreview && !p.canRespond}
                save={<SavePro proId={p.id} />}
                actions={
                  <ProfessionalActions
                    proId={p.id}
                    projectId={page === "saved" ? undefined : match}
                    saved={page === "saved"}
                  />
                }
              />
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
            : openDiscovery
              ? "Check back soon as more professionals join."
              : openProjects.length
                ? "We'll show professionals here as matches become available."
                : "Tell us what you need and where. We'll help you find a pro."}
          <button onClick={() => go("projects", "new")}>
            <Plus size={17} />
            <T>{"Start a project"}</T>{" "}
          </button>
        </Empty>
      )}
    </section>
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
        <Head title={<T>{"Professional profile"}</T>} />
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
          <Search size={17} /> <T>{"Back to professionals"}</T>{" "}
        </button>
        <SavePro proId={p.id} label />
      </div>
      {data.marketplacePreview && !p.canRespond && (
        <p className="availability-note">
          <CalendarDays size={16} /> This business isn't accepting new requests
          yet.
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
                    <Plus size={17} /> <T>{"Start a project"}</T>{" "}
                  </button>
                </>
              )}
              <small className="muted">
                Chat and scheduled calls are available in your project
                conversation.
              </small>
            </>
          ) : undefined
        }
      />
    </>
  );
}
function Projects() {
  const { data, id, run, go } = useWorkspace();
  if (!id) return <CustomerDashboard />;
  return (
    <ProjectIntake
      data={data}
      draftMode={id === "draft"}
      proId={id}
      onAuthenticate={() => go("login")}
      onPublished={async (projectId) => {
        await run(
          async () => {},
          "Project published. Review your matching professionals below.",
          () => go("project", projectId),
        );
      }}
    />
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
  useEffect(() => {
    if (editing) jumpTo("project-edit");
  }, [editing]);
  if (!p)
    return (
      <Empty title="Project unavailable.">
        You may not have access to this project.
      </Empty>
    );
  const customer = p.customerId === data.user.id,
    pro = p.proId === data.user.id;
  const own = customer || pro;
  const DetailsContainer = customer ? "details" : "div";
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
  const projectPhotos = data.uploads.filter(
    (f) =>
      f.projectId === p.id &&
      f.status === "ready" &&
      f.contentType.startsWith("image/"),
  );
  const submit = (body: unknown) =>
    request("/projects/" + p.id + "/actions", {
      ...(body as object),
      expectedVersion: p.version,
    });
  return (
    <div
      className={"project-detail-page" + (customer ? " customer-project" : "")}
    >
      {customer ? (
        <CustomerProjectHeader project={p} onBack={() => go("dashboard")} />
      ) : (
        <Head
          title={p.title}
          action={<Badge>{p.status.replace("_", " ")}</Badge>}
        >
          {p.category} · {p.zip}
        </Head>
      )}
      <ProjectContact key={p.id} projectId={p.id} />
      {data.marketplacePreview &&
        data.user.role === "pro" &&
        !!data.discoveryRequirements?.length && (
          <SetupNotice
            requirements={data.discoveryRequirements}
            onContinue={() => go("profile")}
          />
        )}
      {!customer && (
        <ProjectActionBar
          project={p}
          canRespond={canQuote && !previewBlocked}
          hasEstimates={quotes.some(
            (q) => !q.assessmentRequired && q.status === "pending",
          )}
          hasOwnEstimate={!!ownQuote && ownQuote.status === "pending"}
          onPropose={() => {
            setAction("reschedule");
            jumpTo("project-details");
          }}
          onEdit={() => setEditing(true)}
        />
      )}
      {!customer &&
        data.user.role === "pro" &&
        open &&
        !p.proId &&
        canQuote &&
        !previewBlocked && <OpportunityResponse project={p} />}
      {editing && customer && (
        <section id="project-edit" aria-label="Edit project details">
          <EditDetails
            project={p}
            submit={submit}
            onDone={() => setEditing(false)}
          />
        </section>
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
              () => go("dashboard"),
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
      <div className="two-columns project-detail-columns">
        <DetailsContainer
          id="project-details"
          key={p.id}
          className={customer ? "project-details-disclosure" : undefined}
        >
          {customer && (
            <summary>
              <FileText size={20} />
              <span>
                <strong>
                  <T>{"Project details"}</T>
                </strong>
                <small>
                  {p.category} · {p.zip} · {p.propertyType.replaceAll("_", " ")}
                </small>
              </span>
              <span className="project-details-chips" aria-hidden="true">
                {Object.values(p.intake || {})
                  .slice(0, 3)
                  .map((v, i) => (
                    <span key={i}>{v}</span>
                  ))}
              </span>
              <span className="project-expand-label">
                <span className="expand-copy">
                  <T>{"Expand details"}</T>
                </span>
                <span className="collapse-copy">
                  <T>{"Collapse details"}</T>
                </span>
              </span>
              <ChevronDown size={20} className="disclosure-chevron" />
            </summary>
          )}
          <Panel title={customer ? undefined : "Project details"}>
            {customer ? (
              <CustomerProjectDetails project={p} />
            ) : (
              <>
                <p className="project-description">{p.description}</p>
                {p.intake && Object.keys(p.intake).length > 0 && (
                  <section
                    className="intake-summary"
                    aria-labelledby="intake-title"
                  >
                    <h3 id="intake-title">
                      <T>{"Service questionnaire"}</T>
                    </h3>
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
                  <dt>
                    <T>{"Customer"}</T>
                  </dt>
                  <dd>{p.customerName || "Private until booked"}</dd>
                  <dt>
                    <T>{"Professional"}</T>
                  </dt>
                  <dd>{p.proName || "Choosing the right fit"}</dd>
                  {own && p.address && (
                    <>
                      <dt>
                        <T>{"Service address"}</T>
                      </dt>
                      <dd>
                        {p.address} {p.addressUnit}
                      </dd>
                    </>
                  )}
                  <dt>
                    <T>{"Appointment"}</T>
                  </dt>
                  <dd>{date(p.scheduledAt)}</dd>
                  <dt>
                    <T>{"Timing"}</T>
                  </dt>
                  <dd>{p.urgency.replace("_", " ")}</dd>
                  <dt>
                    <T>{"Property type"}</T>
                  </dt>
                  <dd>{p.propertyType}</dd>
                  <dt>
                    <T>{"Customer budget"}</T>
                  </dt>
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
                        ? quotePrice(ownQuote)
                        : "Awaiting an estimate"}
                  </dd>
                </dl>
              </>
            )}
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
                <button>
                  <T>{"Confirm"}</T> {action}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAction("")}
                >
                  <T>{"Keep current details"}</T>{" "}
                </button>
              </Form>
            )}
          </Panel>
          {!customer && (
            <ProjectPhotoGallery key={p.id} files={projectPhotos} />
          )}
        </DetailsContainer>
        {customer && (
          <aside className="customer-project-sidebar">
            <ProjectPhotoGallery key={p.id} files={projectPhotos} />
            {open && (
              <button
                className="secondary project-add-photos"
                onClick={() => setEditing(true)}
              >
                <Upload size={16} />
                {projectPhotos.length
                  ? "Manage project photos"
                  : "Add project photos"}
              </button>
            )}
            <div className="customer-project-controls">
              <ProjectControls
                key={p.id}
                project={p}
                onEdit={() => setEditing(true)}
                extraActions={
                  <ProjectActionBar
                    compact
                    project={p}
                    canRespond={false}
                    hasEstimates={quotes.some(
                      (q) => !q.assessmentRequired && q.status === "pending",
                    )}
                    hasOwnEstimate={false}
                    onPropose={() => {
                      setAction("reschedule");
                      jumpTo("project-details");
                    }}
                    onEdit={() => setEditing(true)}
                  />
                }
              />
            </div>
          </aside>
        )}
        <div id="project-estimates" className="project-estimates">
          {customer ? (
            <>
              <ProjectProfessionals project={p} submit={submit} />
              <CallMeetings projectId={p.id} compact />
            </>
          ) : (
            <Panel title="Estimates">
              {quotes.length ? (
                quotes.map((q) => (
                  <article className="quote-item" key={q.id}>
                    <div>
                      <h3>{quotePrice(q)}</h3>
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
                      <dt>
                        <T>{"Estimated completion"}</T>
                      </dt>
                      <dd>{quoteTiming(q)}</dd>
                      {q.exclusions && (
                        <>
                          <dt>
                            <T>{"Exclusions"}</T>
                          </dt>
                          <dd>{q.exclusions}</dd>
                        </>
                      )}
                      <dt>
                        <T>{"Valid until"}</T>
                      </dt>
                      <dd>
                        {q.expiresAt ? date(q.expiresAt) : "No expiration"}
                      </dd>
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
                          <T>{"View profile"}</T>{" "}
                        </button>
                        <SavePro proId={q.proId} label />
                      </div>
                    )}
                    {customer && q.status === "pending" && open && (
                      <div className="actions">
                        {!q.assessmentRequired &&
                          q.amount !== null &&
                          !(
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
                                    `Accept ${quotePrice(q)} from ${business}? This professional must confirm the job. Your other estimates stay on hold until they do.`,
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
                              <T>{"Accept estimate"}</T>{" "}
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
                          <T>{"Decline"}</T>{" "}
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
                              The customer will be notified and cannot accept
                              this estimate. You can submit a new version while
                              the request remains open.
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
                    <button
                      className="text-button"
                      onClick={() => go("profile")}
                    >
                      <T>{"Review your profile"}</T>{" "}
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
                    <EstimateForm
                      key={p.id + ":" + (ownQuote?.revision || 0)}
                      quote={ownQuote}
                      submit={submit}
                    />
                  </div>
                )}
            </Panel>
          )}
        </div>
      </div>
      {own && !customer && (
        <div className="project-operation-grid">
          <ProjectControls key={p.id} project={p} />
        </div>
      )}
    </div>
  );
}
function Quotes() {
  const { data, go } = useWorkspace();
  return (
    <>
      <Head title={<T>{"Estimates"}</T>}>
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
              <strong>{quotePrice(q)}</strong>
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
      <Head title={<T>{"Schedule"}</T>}>
        Appointment times are shown in your current device timezone.
      </Head>
      <CallMeetings />
      <Panel title="Upcoming site visits">
        <ProjectList
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
      <h1 className="sr-only">
        <T>{"Messages"}</T>
      </h1>
      <MessagesInbox />
    </>
  );
}
function Reviews() {
  const { data, run, busy } = useWorkspace();
  const [photosBusy, setPhotosBusy] = useState(false);
  const ready = data.projects.filter(
    (p) =>
      p.status === "completed" &&
      data.user.id === p.customerId &&
      !data.reviews.some(
        (x) =>
          x.projectId === p.id ||
          (x.proId === p.proId &&
            Date.now() - new Date(x.createdAt).getTime() < 30 * 86400000),
      ),
  );
  return (
    <>
      <Head title={<T>{"Reviews"}</T>}>
        Thoughtful feedback helps the community make better choices.
      </Head>
      <p className="review-trust-note">
        <T>
          Reviews come from customers with a completed project on Aplime. This
          verifies the project connection, not payment or the quality of the
          work. Both positive and negative feedback are welcome.
        </T>
      </p>
      {data.user.role === "customer" && (
        <p className="muted">
          <T>
            One review per project, and one review per professional every 30
            days.
          </T>
        </p>
      )}
      {ready.map((p) => (
        <Panel title={"Review " + p.title} key={p.id}>
          <Form
            busy={busy || photosBusy}
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
            <ReviewPhotoEditor
              projectId={p.id}
              editable
              onBusy={setPhotosBusy}
            />
            <RatingPicker />
            <Field label="How did it go?">
              <textarea
                name="body"
                minLength={10}
                maxLength={2000}
                rows={5}
                required
              />
              <small>
                <T>
                  Describe the work, communication and results. Keep addresses,
                  phone numbers and other private information out of your
                  review.
                </T>
              </small>
            </Field>
            <button>
              <T>{"Publish review"}</T>
            </button>
          </Form>
        </Panel>
      ))}
      <Panel title="Reviews">
        {data.reviews.length ? (
          data.reviews.map((r) => (
            <article className="review" key={r.id}>
              <ReviewCard
                review={{
                  ...r,
                  completedProject: data.projects.some(
                    (p) =>
                      p.id === r.projectId &&
                      p.status === "completed" &&
                      p.proId === r.proId,
                  ),
                }}
                context={data.projects.find((p) => p.id === r.projectId)?.title}
              />
              <ReviewPhotoEditor
                projectId={r.projectId}
                editable={data.user.role === "customer"}
              />
              {!r.reply && r.proId === data.user.id && (
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
                  <button>
                    <T>{"Reply"}</T>
                  </button>
                </Form>
              )}
            </article>
          ))
        ) : (
          <Empty title="No reviews yet.">
            <T>{"Reviews are available after completed projects."}</T>{" "}
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
function Settings() {
  const { data, run, busy } = useWorkspace();
  return (
    <>
      <Head title={<T>{"Settings"}</T>}>
        <T>{"Manage your account preferences."}</T>
      </Head>
      <Panel title="Preferred language">
        <LanguageSelect
          onChange={(language) =>
            request("/account/language", { language }, "PUT")
          }
        />
        <p>
          <T>
            Automatic chat translation is not enabled. Messages stay in their
            original language.
          </T>
        </p>
      </Panel>
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
                  emailCategories: Object.fromEntries(
                    Object.keys(emailCategories).map((key) => [
                      key,
                      f.get("email:" + key) === "on",
                    ]),
                  ),
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
            <T>{"Enable optional email alerts"}</T>{" "}
          </label>
          {Object.entries(emailCategories).map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                name={"email:" + key}
                defaultChecked={
                  (
                    data.user.settings.emailCategories as
                      Record<string, boolean> | undefined
                  )?.[key] !== false
                }
              />
              {label}
            </label>
          ))}
          <p>
            <T>
              {
                "Essential security, billing, account restrictions and direct Aplime support messages may still be sent. In-app notifications stay available."
              }
            </T>{" "}
          </p>
          <button>
            <T>{"Save preferences"}</T>
          </button>
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
                <T>{"Unblock"}</T>{" "}
              </button>
            </div>
          ))
        ) : (
          <p>
            <T>{"No blocked conversations."}</T>
          </p>
        )}
      </Panel>
      <AccountData />
    </>
  );
}
function Support() {
  const { id } = useWorkspace();
  return (
    <>
      <Head title={<T>{"Help & safety"}</T>}>
        Contact Aplime about your account or a project. For emergencies, contact
        local emergency services.
      </Head>
      <MessagesInbox legacySupportId={id} />
    </>
  );
}
