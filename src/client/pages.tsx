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
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import {
  Empty,
  Head,
  Panel,
  Badge,
  Field,
  Form,
  ServiceIcon,
} from "./ui.js";
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
      return <Payments />;
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
            pro ? "Earned so far" : "Payments",
            money(
              data.payments
                .filter((p) => p.status === "paid")
                .reduce((n, p) => n + p.amount, 0),
            ),
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
          {pro &&
          !data.profiles.find((p) => p.id === data.user.id)?.verified ? (
            <>
              <ShieldCheck />
              <h3>Finish your professional setup.</h3>
              <p>
                Save your business profile, verify your identity, and connect
                payouts.
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
            <Empty title="You’re all caught up.">
              We’ll put important updates here.
            </Empty>
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
                  <p>
                    {p.name}
                  </p>
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
  const [creating, setCreating] = useState(!!id),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState("");
  const source = page === "leads" ? data.leads : data.projects;
  return (
    <>
      <Head
        title={
          page === "leads"
            ? "Your next great job is nearby."
            : data.user.role === "pro"
              ? "Good work, in progress."
              : "A little progress, every day."
        }
        action={
          data.user.role === "customer" ? (
            <button onClick={() => setCreating(!creating)}>
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
          <Form
            busy={busy}
            onSubmit={(f) =>
              run(async () => {
                const result = await request("/projects", {
                  title: f.get("title"),
                  description: f.get("description"),
                  category: f.get("category"),
                  zip: f.get("zip"),
                  proId: id || null,
                  scheduledAt: f.get("scheduledAt")
                    ? new Date(String(f.get("scheduledAt"))).toISOString()
                    : null,
                });
                setCreating(false);
                go("project", result.id);
              }, "Project created.")
            }
          >
            <div className="form-grid">
              <Field label="Project title">
                <input name="title" required minLength={5} maxLength={120} />
              </Field>
              <Field label="Service">
                <select
                  name="category"
                  defaultValue={
                    data.profiles.find((p) => p.id === id)?.category ||
                    categories[0]
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
              />
            </Field>
            <button>Create project</button>
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
  const payment = data.payments.find((x) => x.projectId === p.id);
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
      <div className="two-columns">
        <Panel title="Project details">
          <p className="project-description">{p.description}</p>
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
            {pro && p.status === "in_progress" && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => submit({ type: "complete" }),
                    "Work marked complete.",
                  )
                }
              >
                Mark complete
              </button>
            )}
            {customer &&
              p.status === "completed" &&
              !payment?.status.includes("paid") &&
              payment?.status !== "refunded" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await request(
                        "/projects/" + p.id + "/checkout",
                        {},
                      );
                      await openExternal(r.url);
                    }, "")
                  }
                >
                  Pay securely
                </button>
              )}
            {own && ["requested", "quoted", "booked"].includes(p.status) && (
              <>
                <button
                  className="secondary"
                  onClick={() => setAction("reschedule")}
                >
                  Reschedule
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
                  ? "Choose a new appointment"
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
                  <Badge>{q.status}</Badge>
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
                          () => submit({ type: "accept", quoteId: q.id }),
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
            !quotes.some((q) => q.proId === data.user.id) && (
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
                <Field label="Total estimate (USD)">
                  <input
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
      {own && (
        <Panel title="Project attachments">
          <p>
            Share photos or project documents. Do not upload identity documents
            here; use your business verification flow.
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
                    const r = await request("/uploads/" + f.id);
                    await openExternal(r.url);
                  }, "")
                }
              >
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
              <Badge>{q.status}</Badge>
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
  const { data, id, go, run, busy } = useWorkspace();
  const threads = data.projects.filter((p) => p.proId);
  const p = threads.find((p) => p.id === id) || threads[0];
  const [draft, setDraft] = useState("");
  const other = p
    ? data.user.id === p.customerId
      ? p.proId
      : p.customerId
    : null;
  return (
    <>
      <Head title="Good work starts with a conversation.">
        Project details, questions, and updates together.
      </Head>
      {!p ? (
        <Empty title="No conversations yet.">
          Choose a professional for your project to start a conversation.
        </Empty>
      ) : (
        <div className="inbox">
          <aside>
            {threads.map((t) => (
              <button
                className={p.id === t.id ? "thread active" : "thread"}
                key={t.id}
                onClick={() => go("messages", t.id)}
              >
                <strong>{t.title}</strong>
                <small>{t.proName || t.customerName}</small>
              </button>
            ))}
          </aside>
          <section className="chat">
            <header>
              <div>
                <h2>{p.title}</h2>
                <span>
                  {data.user.id === p.customerId ? p.proName : p.customerName}
                </span>
              </div>
              <div className="actions">
                {[true, false].map((audio) => (
                  <button
                    className="icon-button"
                    aria-label={audio ? "Start audio call" : "Start video call"}
                    disabled={busy || data.blocked.includes(other!)}
                    key={String(audio)}
                    onClick={() =>
                      void run(async () => {
                        const r = await request("/projects/" + p.id + "/call", {
                          audioOnly: audio,
                        });
                        await openExternal(r.url);
                      }, "")
                    }
                  >
                    {audio ? <Phone size={20} /> : <Video size={20} />}
                  </button>
                ))}
              </div>
            </header>
            <p className="call-note">
              Calls open in a secure calling window. The other participant can
              join from this project.
            </p>
            <div
              className="message-log"
              role="log"
              aria-label="Project messages"
            >
              {data.messages
                .filter((m) => m.projectId === p.id)
                .map((m) => (
                  <article
                    className={
                      m.senderId === data.user.id ? "message mine" : "message"
                    }
                    key={m.id}
                  >
                    <p>{m.body}</p>
                    <small>{date(m.createdAt)}</small>
                  </article>
                ))}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await request("/projects/" + p.id + "/messages", {
                    body: draft,
                  });
                  setDraft("");
                }, "");
              }}
            >
              <label className="sr-only" htmlFor="message">
                Your message
              </label>
              <input
                id="message"
                value={draft}
                maxLength={4000}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                disabled={data.blocked.includes(other!)}
              />
              <button
                disabled={
                  busy || !draft.trim() || data.blocked.includes(other!)
                }
              >
                Send
              </button>
            </form>
            <button
              className="text-button"
              onClick={() =>
                void run(() =>
                  request("/blocked/" + other, {
                    blocked: !data.blocked.includes(other!),
                  }),
                )
              }
            >
              {data.blocked.includes(other!)
                ? "Unblock conversation"
                : "Block conversation"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
function Payments() {
  const { data, run, busy, page, go } = useWorkspace();
  const payments = data.payments;
  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((n, p) => n + p.amount, 0);
  return (
    <>
      <Head
        title={
          page === "earnings"
            ? "Good work deserves a clear picture."
            : "Every payment, accounted for."
        }
      >
        {page === "earnings"
          ? "Gross payments are shown before platform fees. Stripe manages payout timing."
          : "Payments are confirmed by Stripe, not by a return-page redirect."}
      </Head>
      <div className="stats">
        <div className="stat">
          <span>{page === "earnings" ? "Gross payments" : "Total paid"}</span>
          <strong>{money(paid)}</strong>
        </div>
        <div className="stat">
          <span>Refunded</span>
          <strong>
            {money(
              payments
                .filter((p) => p.status === "refunded")
                .reduce((n, p) => n + p.amount, 0),
            )}
          </strong>
        </div>
      </div>
      {data.user.role === "customer" && (
        <Panel title="Completed work ready for payment">
          <ProjectList
            projects={data.projects.filter(
              (p) =>
                p.status === "completed" &&
                !payments.some(
                  (pay) => pay.projectId === p.id && pay.status !== "pending",
                ),
            )}
          />
        </Panel>
      )}
      <Panel title="Payment history">
        {payments.length ? (
          payments.map((pay) => (
            <article className="payment-row" key={pay.id}>
              <div>
                <strong>
                  {data.projects.find((p) => p.id === pay.projectId)?.title}
                </strong>
                <small>{date(pay.createdAt)}</small>
              </div>
              <strong>{money(pay.amount)}</strong>
              <Badge>{pay.status}</Badge>
              {pay.status !== "pending" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await request(
                        "/payments/" + pay.id + "/receipt",
                      );
                      await openExternal(r.url);
                    }, "")
                  }
                >
                  Receipt
                </button>
              )}
            </article>
          ))
        ) : (
          <Empty title="No payments yet.">
            Completed project payments will appear here.
          </Empty>
        )}
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
      data.payments.some((x) => x.projectId === p.id && x.status === "paid") &&
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
            Reviews are available after completed, paid projects.
          </Empty>
        )}
      </Panel>
    </>
  );
}
function Business() {
  const { data, run, busy } = useWorkspace();
  if (data.user.role !== "pro")
    return <Empty title="Professional account required." />;
  const p = data.profiles.find((p) => p.id === data.user.id);
  return (
    <>
      <Head title="Let your work make the introduction.">
        Complete your profile, verify your identity, and set up payouts.
      </Head>
      <div className="setup-steps">
        <Badge>{p ? "✓ Profile saved" : "1. Create profile"}</Badge>
        <Badge>
          {p?.verified ? "✓ Identity verified" : "2. Verify identity"}
        </Badge>
        <Badge>
          {p?.connectReady ? "✓ Payouts ready" : "3. Connect payouts"}
        </Badge>
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
        <Panel title="Receive payments">
          <CreditIcon />
          <p>
            {p?.connectReady
              ? "Your payout account is ready."
              : "Connect your payout details securely through Stripe. Identity verification must be completed first."}
          </p>
          <button
            disabled={busy || !p?.verified}
            onClick={() =>
              void run(async () => {
                const r = await request("/profile/connect", {});
                await openExternal(r.url);
              }, "")
            }
          >
            Set up or update payouts
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
