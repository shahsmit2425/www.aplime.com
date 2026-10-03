import { Discussions } from "./discussions.js";
import {
  ProjectPhotos,
  sendProjectPhoto,
  type ProjectPhoto,
} from "./project-photos.js";
import { businessFields } from "../shared/business.js";
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
  Heart,
} from "lucide-react";
import {
  categories,
  money,
  type Project,
  type Profile,
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
  const { page } = useWorkspace();
  switch (page) {
    case "dashboard":
      return <Dashboard />;
    case "discover":
    case "saved":
      return <Directory />;
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
    case "profile":
    case "availability":
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
function ProjectList({ projects }: { projects: Project[] }) {
  const { go } = useWorkspace();
  return projects.length ? (
    <div className="project-list">
      {projects.map((p) => (
        <button
          className="project-row"
          key={p.id}
          onClick={() => go("project", p.id)}
        >
          <span className="category-icon">
            <ServiceIcon service={p.category} size={19} />
          </span>
          <span>
            <strong>{p.title}</strong>
            <small>
              {p.category} · {p.proName || p.customerName || p.zip}
            </small>
          </span>
          <span className="row-date">{date(p.scheduledAt)}</span>
          <Badge>{p.status.replace("_", " ")}</Badge>
          <ArrowUpRight size={17} />
        </button>
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
          <button onClick={() => go(pro ? "leads" : "projects")}>
            <Plus size={17} />
            {pro ? "Find opportunities" : "Start a project"}
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
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
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
            {pro ? "Your business profile" : "Find the right pro"}
            <ArrowUpRight size={16} />
          </button>
        </div>
        <img src="/home.jpg" alt="Bright living room with a blue sofa" />
      </section>
      <div className="two-columns">
        <Panel title="Recent projects">
          <ProjectList projects={data.projects.slice(0, 4)} />
        </Panel>
        <Panel title="Needs your attention">
          {data.projects
            .filter(
              (p) =>
                (p.status === "in_progress" &&
                  p.completionRequested &&
                  p.customerId === data.user.id) ||
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
                    {p.completionRequested && p.customerId === data.user.id
                      ? "Review completed work"
                      : "Respond to appointment proposal"}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          {pro &&
          !data.profiles.find((p) => p.id === data.user.id)?.verified ? (
            <>
              <ShieldCheck />
              <h3>Finish your professional setup.</h3>
              <p>
                Save your business profile, verify your identity, and activate
                your subscription.
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
  const { data, page, run, go, busy } = useWorkspace();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(
      new URLSearchParams(location.search).get("category") || "",
    ),
    [zip, setZip] = useState(""),
    [locationLabel, setLocationLabel] = useState("");
  const profiles = data.profiles.filter(
    (p) =>
      (page === "people" || (p.verified && !p.suspended)) &&
      (page !== "saved" || data.saved.includes(p.id)) &&
      (!category || p.category === category) &&
      (!zip || p.zip.startsWith(zip)) &&
      (p.business + " " + p.name).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Head
        title={
          page === "people"
            ? "The people behind the good work."
            : page === "saved"
              ? "Your home’s go-to people."
              : "Find your next great professional."
        }
      >
        Browse real professional profiles and start a conversation about your
        project.
      </Head>
      <div className="filters">
        <Field label="Search professionals">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or business"
          />
        </Field>
        <Field label="Service">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All services</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="ZIP code">
          <input
            value={zip}
            maxLength={5}
            inputMode="numeric"
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <button
          className="secondary"
          disabled={zip.length !== 5 || busy}
          onClick={() =>
            void run(async () => {
              const l = await request("/location/" + zip);
              setLocationLabel(l?.label || "No location found.");
            }, "")
          }
        >
          Check location
        </button>
      </div>
      {locationLabel && <p>{locationLabel}</p>}
      {profiles.length ? (
        <div className="pro-grid">
          {profiles.map((p) => (
            <Panel key={p.id}>
              <div className="pro-heading">
                <span className="avatar large">{p.name.slice(0, 1)}</span>
                <div>
                  <h2>{p.business}</h2>
                  <p>{p.name}</p>
                  <span className="pro-service">
                    <ServiceIcon service={p.category} size={15} />
                    {p.category}
                  </span>
                </div>
              </div>
              <p>{p.bio}</p>
              <div className="pro-meta">
                <span>
                  {p.reviewCount
                    ? p.rating.toFixed(1) + " ★ · " + p.reviewCount + " reviews"
                    : "No reviews yet"}
                </span>
                <span>${p.rate}/hr starting rate</span>
              </div>
              <div className="tags">
                <Badge>
                  {p.verified ? "Identity verified" : "Verification pending"}
                </Badge>
                <Badge>
                  {p.suspended
                    ? "Suspended"
                    : p.available
                      ? "Available"
                      : "Not accepting requests"}
                </Badge>
                <Badge>{p.zip}</Badge>
              </div>
              <div className="actions">
                {data.user.role === "customer" ? (
                  <>
                    <button
                      disabled={!p.available}
                      onClick={() => go("projects", p.id)}
                    >
                      Request an estimate
                    </button>
                    <button
                      aria-label="Save professional"
                      className="icon-button"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          request("/saved/" + p.id, {
                            saved: !data.saved.includes(p.id),
                          }),
                        )
                      }
                    >
                      <Heart
                        fill={
                          data.saved.includes(p.id) ? "currentColor" : "none"
                        }
                        size={19}
                      />
                    </button>
                  </>
                ) : null}
                <a href={"/professionals/" + encodeURIComponent(p.id)}>
                  View public profile →
                </a>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          title={
            page === "saved"
              ? "No saved professionals yet."
              : "No professionals match yet."
          }
        >
          Try another service or ZIP code. Only verified, active listings appear
          in search.
        </Empty>
      )}
    </>
  );
}
function Projects() {
  const { data, page, id, run, busy, go } = useWorkspace();
  const selectedProfessional = data.profiles.find((p) => p.id === id);
  const initialCategory = (selectedProfessional?.category ||
    categories[0]) as ServiceCategory;
  const [creating, setCreating] = useState(!!id),
    [projectCategory, setProjectCategory] =
      useState<ServiceCategory>(initialCategory),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const source = page === "leads" ? data.leads : data.projects;
  return (
    <>
      <Head
        title={
          page === "leads"
            ? "Find your next project"
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
        Requests, estimates, and updates stay together.
      </Head>
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
          <Form
            busy={busy}
            onSubmit={(f) =>
              run(async () => {
                const result = savedProjectId
                  ? { id: savedProjectId }
                  : await request("/projects", {
                      title: f.get("title"),
                      description: f.get("description"),
                      category: projectCategory,
                      intake: Object.fromEntries(
                        questionsFor(projectCategory).map((question) => [
                          question.id,
                          String(f.get("intake_" + question.id) || "").trim(),
                        ]),
                      ),
                      zip: f.get("zip"),
                      proId: id || null,
                      scheduledAt: f.get("scheduledAt")
                        ? new Date(String(f.get("scheduledAt"))).toISOString()
                        : null,
                    });
                setSavedProjectId(result.id);
                try {
                  for (let index = 0; index < photos.length; index++) {
                    setUploadProgress(
                      `Uploading photo ${index + 1} of ${photos.length}…`,
                    );
                    await sendProjectPhoto(result.id, photos[index]);
                    setPhotos([...photos]);
                  }
                } catch (error) {
                  setUploadProgress(
                    "Your project is saved. Some photos could not be uploaded. Retry below, or open your project to continue later.",
                  );
                  throw error;
                }
                setUploadProgress("");
                setCreating(false);
                go("project", result.id);
              }, "Project created.")
            }
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
                      setProjectCategory(event.target.value as ServiceCategory)
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ZIP code">
                  <input
                    name="zip"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Preferred appointment (optional)">
                  <input name="scheduledAt" type="datetime-local" />
                </Field>
              </div>
              <Field label="What needs to be done?">
                <textarea
                  name="description"
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
                          defaultValue=""
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
                        />
                      ) : (
                        <input
                          name={"intake_" + question.id}
                          required={question.required}
                          minLength={question.required ? 2 : undefined}
                          maxLength={1500}
                          placeholder={question.placeholder}
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
                Send your request to start discussing the work. This does not
                confirm an appointment or make a payment.
              </p>
              <p role="status" aria-live="polite">
                {uploadProgress}
              </p>
              <div className="actions">
                <button>
                  {busy
                    ? "Saving your project…"
                    : savedProjectId
                      ? "Retry remaining photos"
                      : "Send project request"}
                </button>
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
                      setCreating(false);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </Form>
        </Panel>
      )}
      <div className="filters">
        <Field label="Search projects">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {[
              "requested",
              "quoted",
              "booked",
              "in_progress",
              "completed",
              "cancelled",
              "disputed",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Panel>
        <ProjectList
          projects={source.filter(
            (p) =>
              (!status || p.status === status) &&
              p.title.toLowerCase().includes(search.toLowerCase()),
          )}
        />
      </Panel>
    </>
  );
}
function ProjectDetail() {
  const { data, id, run, busy, go } = useWorkspace();
  const p = [...data.projects, ...data.leads].find((p) => p.id === id);
  const [action, setAction] = useState("");
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
  const submit = (body: unknown) =>
    request("/projects/" + p.id + "/actions", body);
  return (
    <>
      <Head
        title={p.title}
        action={<Badge>{p.status.replace("_", " ")}</Badge>}
      >
        {p.category} · {p.zip}
      </Head>
      <section className="project-next-step" aria-label="Your next step">
        <div>
          <small>YOUR NEXT STEP</small>
          <h2>
            {p.completionRequested
              ? customer
                ? "Review the completed work"
                : "Waiting for customer confirmation"
              : p.status === "requested"
                ? customer
                  ? "Discuss your request with professionals"
                  : "Ask a question or prepare an estimate"
                : p.status === "quoted"
                  ? customer
                    ? "Compare estimates and choose your professional"
                    : "Answer questions and keep your estimate up to date"
                  : p.status === "booked"
                    ? "Agree on the appointment and prepare for work"
                    : p.status === "in_progress"
                      ? "Keep each other updated as work progresses"
                      : p.status === "completed"
                        ? "Work completed — share your experience"
                        : "Check your project status and support updates"}
          </h2>
          <p>
            Service payments are arranged directly. Aplime charges professionals
            only for their subscription.
          </p>
        </div>
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
                  ].indexOf(p.status)
                    ? "reached"
                    : ""
                }
              >
                {label}
              </li>
            ),
          )}
        </ol>
      </section>
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
      {customer && p.status === "in_progress" && p.completionRequested && (
        <Panel title="The professional has requested completion">
          <p>
            Review the work before confirming. If something needs attention, use
            “Get help with this project” below.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(
                () => submit({ type: "confirm_completion" }),
                "Project completed. You can now leave a review.",
              )
            }
          >
            Confirm work completed
          </button>
        </Panel>
      )}
      <div className="two-columns">
        <Panel title="Project details">
          <p className="project-description">{p.description}</p>
          {p.intake && Object.keys(p.intake).length > 0 && (
            <section className="intake-summary" aria-labelledby="intake-title">
              <h3 id="intake-title">Service questionnaire</h3>
              <dl>
                {Object.entries(p.intake).map(([key, value]) => (
                  <div key={key}>
                    <dt>{questionLabel(p.category as ServiceCategory, key)}</dt>
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
            <dt>Appointment</dt>
            <dd>{date(p.scheduledAt)}</dd>
            <dt>Agreed total</dt>
            <dd>{p.amount ? money(p.amount) : "Awaiting an estimate"}</dd>
          </dl>
          <div className="actions">
            {own && p.proId && (
              <button
                className="secondary"
                onClick={() => go("messages", p.id)}
              >
                <MessageCircle size={17} />
                Open conversation
              </button>
            )}
            {pro && p.status === "booked" && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => submit({ type: "start" }), "Work started.")
                }
              >
                Start work
              </button>
            )}
            {pro && p.status === "in_progress" && !p.completionRequested && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => submit({ type: "complete" }),
                    "Completion requested. The customer will confirm.",
                  )
                }
              >
                Request completion
              </button>
            )}
            {own && ["requested", "quoted", "booked"].includes(p.status) && (
              <>
                <button
                  className="secondary"
                  onClick={() => setAction("reschedule")}
                >
                  Propose appointment
                </button>
                <button
                  className="text-button"
                  onClick={() => setAction("cancel")}
                >
                  Cancel project
                </button>
              </>
            )}
            {own && ["in_progress", "completed"].includes(p.status) && (
              <button
                className="secondary"
                onClick={() => setAction("dispute")}
              >
                Get help with this project
              </button>
            )}
          </div>
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
              {action === "reschedule" ? (
                <Field label="New date and time">
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
        <Panel title="Estimates">
          {quotes.length ? (
            quotes.map((q) => (
              <article className="quote-item" key={q.id}>
                <div>
                  <h3>{money(q.amount)}</h3>
                  <Badge>
                    {q.status} · version {q.revision}
                  </Badge>
                </div>
                <p>
                  {data.profiles.find((p) => p.id === q.proId)?.business ||
                    "Professional"}
                </p>
                <p>{q.description}</p>
                {customer && q.status === "pending" && (
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            submit({
                              type: "accept",
                              quoteId: q.id,
                              revision: q.revision,
                            }),
                          "Estimate accepted.",
                        )
                      }
                    >
                      Accept estimate
                    </button>
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
              </article>
            ))
          ) : (
            <Empty title="No estimates yet.">
              Your estimates will appear here.
            </Empty>
          )}
          {data.user.role === "pro" &&
            ["requested", "quoted"].includes(p.status) &&
            (!p.proId || pro) &&
            !quotes.some(
              (q) => q.proId === data.user.id && q.status !== "pending",
            ) && (
              <Form
                busy={busy}
                onSubmit={(f) =>
                  run(
                    () =>
                      submit({
                        type: "quote",
                        amount: Math.round(Number(f.get("amount")) * 100),
                        description: f.get("description"),
                      }),
                    "Estimate sent.",
                  )
                }
              >
                <h3>
                  {quotes.some((q) => q.proId === data.user.id)
                    ? "Revise your estimate"
                    : "Send a priced estimate"}
                </h3>
                <p>
                  Explain the scope, exclusions, and expected timing. Pending
                  estimates can be updated before acceptance.
                </p>
                <Field label="Total estimate (USD)">
                  <input
                    key={
                      "amount-" +
                      quotes.find((q) => q.proId === data.user.id)?.revision
                    }
                    defaultValue={
                      quotes.find((q) => q.proId === data.user.id)
                        ? quotes.find((q) => q.proId === data.user.id)!.amount /
                          100
                        : undefined
                    }
                    type="number"
                    name="amount"
                    min="1"
                    max="100000"
                    step=".01"
                    required
                  />
                </Field>
                <Field label="Scope and inclusions">
                  <textarea
                    key={
                      "scope-" +
                      quotes.find((q) => q.proId === data.user.id)?.revision
                    }
                    defaultValue={
                      quotes.find((q) => q.proId === data.user.id)?.description
                    }
                    name="description"
                    minLength={10}
                    maxLength={2000}
                    required
                  />
                </Field>
                <button>Send estimate</button>
              </Form>
            )}
        </Panel>
      </div>
      <Discussions
        projectId={p.id}
        canStart={
          data.user.role === "pro" &&
          ["requested", "quoted"].includes(p.status) &&
          (!p.proId || pro)
        }
      />
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
                      throw new Error("The file could not be uploaded.");
                    await request("/uploads/" + r.id + "/complete", {});
                  }, "File uploaded.");
              }}
            />
          </Field>
          {data.uploads
            .filter((f) => f.projectId === p.id)
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
              onClick={() => go("project", q.projectId)}
            >
              <span>
                <strong>
                  {data.projects.find((p) => p.id === q.projectId)?.title ||
                    data.leads.find((p) => p.id === q.projectId)?.title ||
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
      <Panel title="Upcoming appointments">
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
      <Head title="Your conversations">
        Discuss the work, clarify estimates, and arrange a consultation. Each
        professional has a separate private conversation.
      </Head>
      <Discussions />
    </>
  );
}
function Subscription() {
  const { data, busy, run } = useWorkspace();
  const [billing, setBilling] = useState<{
    status: string;
    cancelAtPeriodEnd: boolean;
    configured: boolean;
    canManage: boolean;
  } | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (data.user.role !== "pro") return;
    let active = true;
    const refresh = () =>
      request("/subscription")
        .then((result) => {
          if (active) {
            setBilling(result);
            setProblem("");
          }
        })
        .catch((error) => {
          if (active) setProblem(error.message);
        });
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [data.user.id]);
  if (data.user.role !== "pro")
    return (
      <Empty title="No customer payments on Aplime">
        Arrange service payment directly with your professional. Only businesses
        pay Aplime for a subscription.
      </Empty>
    );
  return (
    <>
      <Head title="Your Aplime business subscription">
        Your subscription pays for access to Aplime. Customer service payments
        are arranged directly with customers.
      </Head>
      <Panel title="Professional membership">
        {problem && <p role="alert">{problem}</p>}
        <p>
          Status: <strong>{billing?.status || "Loading…"}</strong>
        </p>
        {billing?.cancelAtPeriodEnd && (
          <p>
            Your subscription will end at the close of the current billing
            period.
          </p>
        )}
        <p>
          Review the subscription price, billing interval, and recurring charge
          in Stripe before confirming. After payment, activation may take a
          moment. This page updates automatically.
        </p>
        {!billing?.configured && billing && (
          <p>Subscription enrollment is not configured yet.</p>
        )}
        <div className="actions">
          <button
            disabled={
              busy ||
              !billing?.configured ||
              !["none", "canceled", "incomplete_expired"].includes(
                billing.status,
              )
            }
            onClick={() =>
              void run(async () => {
                const result = await request("/subscription/checkout", {});
                await openExternal(result.url);
              }, "")
            }
          >
            Start subscription
          </button>
          <button
            className="secondary"
            disabled={busy || !billing?.canManage}
            onClick={() =>
              void run(async () => {
                const result = await request("/subscription/portal", {});
                await openExternal(result.url);
              }, "")
            }
          >
            Manage billing and cancellation
          </button>
        </div>
      </Panel>
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
  const { data, run, busy, go } = useWorkspace();
  if (data.user.role !== "pro")
    return <Empty title="Professional account required." />;
  const p = data.profiles.find((p) => p.id === data.user.id);
  return (
    <>
      <Head title="Let your work make the introduction.">
        Complete your profile, verify your identity, and manage your Aplime
        subscription.
      </Head>
      <div className="setup-steps">
        <Badge>{p ? "✓ Profile saved" : "1. Create profile"}</Badge>
        <Badge>
          {p?.verified ? "✓ Identity verified" : "2. Verify identity"}
        </Badge>
        <Badge>3. Subscribe to Aplime</Badge>
      </div>
      <Panel title="Business profile">
        <Form
          busy={busy}
          onSubmit={(f) =>
            run(
              () =>
                request(
                  "/profile",
                  {
                    details: {
                      ...Object.fromEntries(
                        businessFields.map((field) => [
                          field.key,
                          String(f.get(field.key) || ""),
                        ]),
                      ),
                      yearsExperience: Number(f.get("yearsExperience")),
                      teamSize: Number(f.get("teamSize")),
                      businessType: f.get("businessType"),
                    },
                    business: f.get("business"),
                    category: f.get("category"),
                    bio: f.get("bio"),
                    zip: f.get("zip"),
                    rate: Number(f.get("rate")),
                    available: f.get("available") === "on",
                    availability: f.getAll("days"),
                  },
                  "PUT",
                ),
              "Business profile saved.",
            )
          }
        >
          <div className="form-grid">
            <Field label="Business name">
              <input
                name="business"
                defaultValue={p?.business}
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label="Service">
              <select name="category" defaultValue={p?.category}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Service ZIP code">
              <input
                name="zip"
                defaultValue={p?.zip}
                pattern="[0-9]{5}"
                required
              />
            </Field>
            <Field label="Starting hourly rate (USD)">
              <input
                name="rate"
                defaultValue={p?.rate}
                min="1"
                max="10000"
                type="number"
                step=".01"
                required
              />
            </Field>
          </div>
          <h3>Business information</h3>
          <p>
            These details appear on your business listing. Use business contact
            information. Do not enter a home street address, tax ID, or identity
            document here. Licensing and insurance statements are self-reported.
          </p>
          <div className="form-grid">
            {businessFields.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  name={field.key}
                  defaultValue={p?.details?.[field.key] || ""}
                  required={"required" in field && field.required}
                  type={"type" in field ? field.type : "text"}
                  maxLength={1000}
                />
              </Field>
            ))}
            <Field label="Business type">
              <select
                name="businessType"
                defaultValue={p?.details?.businessType}
              >
                {[
                  "Sole proprietor",
                  "LLC",
                  "Corporation",
                  "Partnership",
                  "Other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Years of experience">
              <input
                name="yearsExperience"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={p?.details?.yearsExperience ?? 0}
              />
            </Field>
            <Field label="Team size">
              <input
                name="teamSize"
                type="number"
                min="1"
                max="10000"
                required
                defaultValue={p?.details?.teamSize ?? 1}
              />
            </Field>
          </div>
          <Field label="About your business">
            <textarea
              name="bio"
              defaultValue={p?.bio}
              minLength={20}
              maxLength={2000}
              rows={5}
              required
            />
          </Field>
          <label className="checkbox">
            <input
              name="available"
              type="checkbox"
              defaultChecked={p?.available ?? true}
            />
            Accepting new requests
          </label>
          <fieldset className="days">
            <legend>Working days</legend>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  name="days"
                  value={day}
                  defaultChecked={p?.availability.includes(day)}
                />
                {day}
              </label>
            ))}
          </fieldset>
          <p className="muted">
            Working days express your preferences. Confirm each appointment with
            your customer.
          </p>
          <button>Save business profile</button>
        </Form>
      </Panel>
      <div className="two-columns">
        <Panel title="Identity verification">
          <ShieldCheck />
          <p>
            {p?.verified
              ? "Your identity has been verified."
              : "Your listing stays private until Stripe verifies your identity. Documents are submitted directly to Stripe."}
          </p>
          <button
            disabled={busy || !p || p.verified}
            onClick={() =>
              void run(async () => {
                const r = await request("/profile/identity", {});
                await openExternal(r.url);
              }, "")
            }
          >
            {p?.verified ? "Verified" : "Verify with Stripe"}
          </button>
        </Panel>
        <Panel title="Aplime subscription">
          <p>
            Only professional businesses pay Aplime. We do not collect customer
            service payments or send professional payouts.
          </p>
          <button onClick={() => go("subscription")}>
            Manage your business subscription →
          </button>
        </Panel>
      </div>
    </>
  );
}
function CreditIcon() {
  return <CheckCircle2 />;
}
function Notifications() {
  const { data, run, busy } = useWorkspace();
  return (
    <>
      <Head
        title="A little update goes a long way."
        action={
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void run(() => request("/notifications/read", {}))}
          >
            Mark all read
          </button>
        }
      >
        Your account and project notifications.
      </Head>
      <Panel>
        {data.notices.length ? (
          data.notices.map((n) => (
            <article className="notice-item" key={n.id}>
              <Badge>{n.read ? "Read" : "New"}</Badge>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{date(n.createdAt)}</small>
            </article>
          ))
        ) : (
          <Empty title="You’re all caught up." />
        )}
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
  const { data, run, busy, page } = useWorkspace();
  return (
    <>
      <Head
        title={
          page === "reports"
            ? "Help people find a way forward."
            : "A little help when you need it."
        }
      >
        Keep important project communication in your account. For emergencies,
        contact local emergency services.
      </Head>
      {page !== "reports" && (
        <Panel title="Contact support">
          <Form
            busy={busy}
            onSubmit={(f) =>
              run(
                () =>
                  request("/support", {
                    subject: f.get("subject"),
                    body: f.get("body"),
                  }),
                "Support request created.",
              )
            }
          >
            <Field label="Subject">
              <input name="subject" minLength={5} maxLength={120} required />
            </Field>
            <Field label="How can we help?">
              <textarea
                name="body"
                minLength={10}
                maxLength={3000}
                rows={4}
                required
              />
            </Field>
            <button>Send support request</button>
          </Form>
        </Panel>
      )}
      <Panel title="Support cases">
        {data.tickets.length ? (
          data.tickets.map((t) => (
            <article className="ticket" key={t.id}>
              <Badge>{t.status}</Badge>
              <h3>{t.subject}</h3>
              <p>{t.body}</p>
              {t.resolution && <blockquote>{t.resolution}</blockquote>}
            </article>
          ))
        ) : (
          <Empty title="No open conversations with support." />
        )}
      </Panel>
    </>
  );
}
