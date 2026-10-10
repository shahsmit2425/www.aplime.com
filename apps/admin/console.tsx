import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  BriefcaseBusiness,
  ShieldCheck,
  CreditCard,
  MessageCircle,
  Activity,
  Bell,
  Search,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  FileText,
  CheckCircle2,
  Clock3,
  Network,
} from "lucide-react";
import type {
  AdminOverview,
  AdminSession,
  AdminUserDetail,
  RecordPage,
  RecordRow,
} from "../../src/shared/admin.js";
import type { Project } from "../../src/shared/domain.js";
import type { SupportThread, SupportTicket } from "../../src/shared/support.js";
type Requester = <T>(path: string, body?: unknown) => Promise<T>;
type Runner = (fn: () => Promise<void>) => Promise<void>;
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const items = [
  ["overview", "Overview", LayoutDashboard],
  ["users", "People", Users],
  ["professionals", "Businesses", Building2],
  ["identity", "Identity", ShieldCheck],
  ["memberships", "Memberships", CreditCard],
  ["projects", "Projects", BriefcaseBusiness],
  ["interactions", "Interactions", Network],
  ["support", "Support inbox", MessageCircle],
  ["audit", "Audit trail", Activity],
  ["updates", "Notifications", Bell],
] as const;
const date = (s: unknown) =>
  s
    ? new Date(String(s)).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const title = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
const text = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
function readRoute() {
  const [page, id] = location.hash.replace(/^#\/?/, "").split("/");
  let decoded = "";
  try {
    decoded = id ? decodeURIComponent(id) : "";
  } catch {
    /* Invalid links return to the collection. */
  }
  return {
    page: items.some((i) => i[0] === page) ? page : "overview",
    id: decoded,
  };
}
function useRemote<T>(
  path: string,
  request: Requester,
  revision: unknown,
  enabled = true,
) {
  const lastPath = useRef("");
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) {
      setValue(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    if (lastPath.current !== path) setValue(null);
    lastPath.current = path;
    setError("");
    request<T>(path)
      .then((v) => {
        if (!cancelled) setValue(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Could not load this view.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, revision, enabled]);
  return { value, error, loading };
}
function Loading({ error, loading }: { error: string; loading: boolean }) {
  return error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : loading ? (
    <p className="admin-empty" role="status">
      Loading records…
    </p>
  ) : null;
}
function Status({ value }: { value: unknown }) {
  const label = String(value || "none");
  return (
    <span
      className={`admin-status ${["approved", "verified", "active", "completed", "resolved", "trialing"].includes(label) ? "positive" : ["rejected", "suspended", "past_due", "disputed", "cancelled"].includes(label) ? "negative" : ""}`}
    >
      {title(label)}
    </span>
  );
}
function Card({
  title: heading,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <h2>{heading}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
function Facts({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="admin-facts">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{title(key)}</dt>
          <dd>
            {typeof value === "object" && value !== null ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : (
              text(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Pager({
  page,
  total,
  pageSize = 25,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="admin-pager">
      <span>
        {total.toLocaleString()} records · page {page} of{" "}
        {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ArrowLeft size={15} /> Previous
        </button>
        <button
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          Next <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
function Table({
  rows,
  open,
}: {
  rows: RecordRow[];
  open?: (row: RecordRow) => void;
}) {
  if (!rows.length)
    return <p className="admin-empty">No records match this view.</p>;
  const keys = Object.keys(rows[0]).filter((k) => k !== "id");
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} scope="col">
                {title(k)}
              </th>
            ))}
            {open && <th scope="col">Details</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr key={String(r.id || index)}>
              {keys.map((k) => (
                <td key={k}>
                  {/status|membership/.test(k) ? (
                    <Status value={r[k]} />
                  ) : /^(amount|laborAmount|materialsAmount)$/.test(k) &&
                    typeof r[k] === "number" ? (
                    money(r[k] as number)
                  ) : k.endsWith("At") ? (
                    date(r[k])
                  ) : (
                    text(r[k])
                  )}
                </td>
              ))}
              {open && (
                <td>
                  <button
                    className="admin-link"
                    onClick={() => open(r)}
                    aria-label={
                      "View " + text(r.business || r.name || r.title || r.id)
                    }
                  >
                    Open <ArrowRight size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TrendChart({ trend }: { trend: AdminOverview["trend"] }) {
  const max = Math.max(
    1,
    ...trend.flatMap((r) => [r.users, r.projects, r.messages]),
  );
  const series = [
    { key: "users", label: "New accounts", color: "#0c8054" },
    { key: "projects", label: "Projects", color: "#1675bc" },
    { key: "messages", label: "Messages", color: "#b56d14" },
  ] as const;
  return (
    <>
      <div
        className="admin-chart"
        role="img"
        aria-label="Daily new accounts, projects and discussion messages over the last 30 days"
      >
        <svg viewBox="0 0 720 210">
          <title>Daily platform activity, last 30 calendar days</title>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1="38"
                x2="708"
                y1={175 - i * 50}
                y2={175 - i * 50}
                stroke="#e2ebe5"
              />
              <text x="0" y={179 - i * 50} fontSize="11" fill="#62766b">
                {Math.round((max * i) / 3)}
              </text>
            </g>
          ))}
          {series.map(({ key, color, label }) => (
            <polyline
              key={key}
              fill="none"
              stroke={color}
              strokeWidth="3"
              points={trend
                .map(
                  (r, i) =>
                    `${38 + (i * 670) / Math.max(1, trend.length - 1)},${175 - (r[key] / max) * 150}`,
                )
                .join(" ")}
            >
              <title>{label}</title>
            </polyline>
          ))}
          <text x="38" y="204" fontSize="11" fill="#62766b">
            {trend[0]?.day}
          </text>
          <text x="630" y="204" fontSize="11" fill="#62766b">
            {trend.at(-1)?.day}
          </text>
        </svg>
      </div>
      <div className="admin-chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <details>
        <summary>View daily values</summary>
        <Table rows={trend} />
      </details>
    </>
  );
}
function Distribution({ rows }: { rows: AdminOverview["statuses"] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.length ? (
    <div className="admin-bars">
      {rows.map((r) => (
        <div key={r.label}>
          <span>{title(r.label)}</span>
          <div>
            <i style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <strong>{r.count.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  ) : (
    <p className="admin-empty">No projects yet.</p>
  );
}
function Interactions({
  request,
  revision,
  go,
  userId = "",
}: {
  request: Requester;
  revision: unknown;
  go: (p: string, id?: string) => void;
  userId?: string;
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [q, setQ] = useState("");
  const { value, ...state } = useRemote<RecordPage>(
    "/interactions?" + new URLSearchParams({ page: String(page), q, userId }),
    request,
    revision,
  );
  const customers = [
    ...new Map(
      (value?.rows || []).map((r) => [
        String(r.customerId),
        String(r.customer),
      ]),
    ).entries(),
  ];
  const pros = [
    ...new Map(
      (value?.rows || []).map((r) => [String(r.proId), String(r.professional)]),
    ).entries(),
  ];
  const height = Math.max(
    220,
    80 + 32 * Math.max(customers.length, pros.length),
  );
  return (
    <Card title="Customer and professional relationships">
      <p className="admin-muted">
        Connections come from saved project assignments, conversations,
        estimates and call invitations. The graph shows this page of
        relationships; use search and pagination for the complete list.
      </p>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <label>
          <span className="sr-only">Search relationships</span>
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder="Customer or business name…"
          />
        </label>
        <button>Search</button>
      </form>
      <Loading {...state} />
      {value && (
        <>
          {!!value.rows.length && (
            <div className="admin-network">
              <svg
                viewBox={`0 0 940 ${height}`}
                role="img"
                aria-label="Customer to professional relationships. Thicker lines indicate more messages. All values are listed below."
              >
                <title>
                  Customer to professional relationships on this page
                </title>
                <text x="16" y="24" className="network-heading">
                  CUSTOMERS
                </text>
                <text x="670" y="24" className="network-heading">
                  PROFESSIONALS
                </text>
                {value.rows.map((r) => {
                  const y1 =
                      60 +
                      32 * customers.findIndex(([id]) => id === r.customerId),
                    y2 = 60 + 32 * pros.findIndex(([id]) => id === r.proId);
                  return (
                    <path
                      key={r.customerId + ":" + r.proId}
                      d={`M250 ${y1} C450 ${y1},490 ${y2},650 ${y2}`}
                      stroke="#77b89a"
                      fill="none"
                      opacity="0.65"
                      strokeWidth={
                        1 + Math.min(6, Math.log2(1 + Number(r.messages)))
                      }
                    >
                      <title>
                        {r.customer} ↔ {r.professional}: {r.projects} projects,{" "}
                        {r.messages} messages
                      </title>
                    </path>
                  );
                })}
                {[
                  { nodes: customers, right: false },
                  { nodes: pros, right: true },
                ].map(({ nodes, right }) =>
                  nodes.map(([id, name], i) => (
                    <a key={id} href={`#/users/${encodeURIComponent(id)}`}>
                      <circle
                        cx={right ? 650 : 250}
                        cy={60 + 32 * i}
                        r="5"
                        fill={right ? "#1675bc" : "#0c8054"}
                      />
                      <text x={right ? 670 : 16} y={65 + 32 * i}>
                        {name.length > 30 ? name.slice(0, 27) + "…" : name}
                        <title>{name}</title>
                      </text>
                    </a>
                  )),
                )}
              </svg>
            </div>
          )}
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Customer",
                    "Professional",
                    "Projects",
                    "Conversations",
                    "Messages",
                    "Estimates",
                    "Call invitations",
                    "Last interaction",
                    "Details",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.rows.map((r) => (
                  <tr key={r.customerId + ":" + r.proId}>
                    <td>
                      <button
                        className="admin-link"
                        onClick={() => go("users", String(r.customerId))}
                      >
                        {r.customer}
                      </button>
                    </td>
                    <td>
                      <button
                        className="admin-link"
                        onClick={() => go("professionals", String(r.proId))}
                      >
                        {r.professional}
                      </button>
                    </td>
                    {[
                      "projects",
                      "conversations",
                      "messages",
                      "estimates",
                      "callInvitations",
                    ].map((k) => (
                      <td key={k}>{r[k]}</td>
                    ))}
                    <td>{date(r.lastInteractionAt)}</td>
                    <td>
                      <button onClick={() => go("users", String(r.proId))}>
                        View account
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!value.rows.length && (
            <p className="admin-empty">
              No recorded relationships match this view.
            </p>
          )}
          <Pager {...value} onChange={setPage} />
        </>
      )}
    </Card>
  );
}
function Overview({
  request,
  revision,
  go,
}: {
  request: Requester;
  revision: unknown;
  go: (page: string, id?: string) => void;
}) {
  const { value: v, ...state } = useRemote<AdminOverview>(
    "/overview",
    request,
    revision,
  );
  return (
    <>
      <Loading {...state} />
      {v && (
        <>
          <div className="admin-metrics">
            {[
              ["users", "Marketplace accounts", Users],
              ["projects", "Projects", BriefcaseBusiness],
              ["memberships", "Active memberships", CreditCard],
              ["pendingReviews", "Awaiting review", Clock3],
              ["completed", "Completed projects", CheckCircle2],
              ["openSupport", "Open support cases", MessageCircle],
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Users;
              return (
                <article key={String(key)}>
                  <I size={19} />
                  <p>{String(label)}</p>
                  <strong>
                    {(v.totals[String(key)] || 0).toLocaleString()}
                  </strong>
                </article>
              );
            })}
          </div>
          <div className="admin-grid">
            <Card
              title="Platform activity"
              aside={
                <span className="admin-muted">Last 30 calendar days · UTC</span>
              }
            >
              <TrendChart trend={v.trend} />
            </Card>
            <Card title="Professional readiness">
              <Facts
                data={{
                  professionalAccounts: v.totals.professionals,
                  identityVerified: v.totals.verified,
                  listedBusinesses: v.totals.listed,
                  activeMemberships: v.totals.memberships,
                }}
              />
              <p className="admin-muted">
                Independent totals; a business needs all eligibility
                requirements to respond.
              </p>
            </Card>
            <Card title="Project lifecycle">
              <Distribution rows={v.statuses} />
            </Card>
            <Card title="Demand by service">
              <Distribution rows={v.categories} />
            </Card>
          </div>
          <div className="admin-metrics compact">
            {[
              "conversations",
              "messages",
              "estimates",
              "callInvitations",
              "files",
              "disputed",
            ].map((key) => (
              <article key={key}>
                <p>{title(key)}</p>
                <strong>{v.totals[key] || 0}</strong>
              </article>
            ))}
          </div>
          <Card
            title="Most active accounts"
            aside={
              <button onClick={() => go("users")}>
                All people <ArrowRight size={15} />
              </button>
            }
          >
            <Table
              rows={v.engagement}
              open={(r) => go("users", String(r.id))}
            />
          </Card>
          <Card title="Recent recorded actions">
            <Table rows={v.recent} />
          </Card>
          <p className="admin-muted">
            Updated {date(v.generatedAt)}. Counts use stored records across the
            database. Call invitations are tracked from this release; they do
            not prove connection, duration or completion. Discussion-message
            trends exclude historical legacy messages. No page views or
            recordings are collected.
          </p>
        </>
      )}
    </>
  );
}
const filterOptions: Record<string, string[]> = {
  users: ["customer", "pro", "admin"],
  professionals: [
    "draft",
    "pending",
    "changes_requested",
    "approved",
    "rejected",
  ],
  identity: ["verified", "pending", "not_started"],
  memberships: [
    "none",
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
  ],
  projects: [
    "requested",
    "quoted",
    "booked",
    "in_progress",
    "paused",
    "completed",
    "cancelled",
    "disputed",
  ],
};
function Collection({
  page: kind,
  request,
  revision,
  go,
  userId = "",
}: {
  page: string;
  request: Requester;
  revision: unknown;
  go: (p: string, id?: string) => void;
  userId?: string;
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  const path =
    `/${kind}?` +
    new URLSearchParams({
      page: String(page),
      q,
      status,
      ...(userId ? { userId } : {}),
    });
  const { value, ...state } = useRemote<RecordPage>(path, request, revision);
  return (
    <Card
      title={userId ? "All projects involving this account" : "Browse records"}
    >
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <label>
          <span className="sr-only">Search records</span>
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or title…"
            maxLength={100}
          />
        </label>
        {filterOptions[kind] && (
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">
                All {kind === "users" ? "roles" : "statuses"}
              </option>
              {filterOptions[kind].map((s) => (
                <option key={s} value={s}>
                  {title(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button>Search</button>
      </form>
      <Loading {...state} />
      {value && (
        <>
          <Table
            rows={value.rows}
            open={kind === "audit" ? undefined : (r) => go(kind, String(r.id))}
          />
          <Pager {...value} onChange={setPage} />
        </>
      )}
    </Card>
  );
}
function UserDetail({
  id,
  request,
  revision,
  run,
  busy,
  go,
  initialTab = "profile",
}: {
  id: string;
  request: Requester;
  revision: unknown;
  run: Runner;
  busy: boolean;
  go: (p: string, id?: string) => void;
  initialTab?: string;
}) {
  const { value: v, ...state } = useRemote<AdminUserDetail>(
    "/users/" + encodeURIComponent(id),
    request,
    revision,
  );
  const [note, setNote] = useState(""),
    [tab, setTab] = useState(initialTab);
  useEffect(() => {
    if (
      v &&
      v.user.role !== "pro" &&
      !["account", "projects", "interactions"].includes(tab)
    )
      setTab("account");
  }, [v?.user.role]);
  const provider = useRemote<Record<string, unknown>>(
    `/users/${encodeURIComponent(id)}/${tab === "identity" ? "identity" : "billing"}`,
    request,
    revision,
    !!v?.profile && ["identity", "membership"].includes(tab),
  );
  const review = async (status: string) =>
    run(async () => {
      await request("/profiles/" + encodeURIComponent(id) + "/review", {
        status,
        note,
      });
      go("professionals");
    });
  return (
    <>
      <Loading {...state} />
      {v && (
        <>
          <div className="admin-detail-heading">
            <div>
              <span className="admin-eyebrow">{v.user.role} account</span>
              <h2>{v.profile?.business || v.user.name}</h2>
              <p>
                {v.user.name} · {v.user.email}
              </p>
            </div>
            {v.user.role !== "admin" && (
              <button onClick={() => go("support", "new:" + id)}>
                <MessageCircle size={17} /> Contact user
              </button>
            )}
          </div>
          <div className="admin-metrics compact">
            {Object.entries(v.metrics).map(([key, value]) => (
              <article key={key}>
                <p>{title(key)}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <nav className="admin-tabs" aria-label="Account details">
            {(v.user.role === "pro"
              ? [
                  "profile",
                  "identity",
                  "membership",
                  "review",
                  "projects",
                  "interactions",
                  "account",
                ]
              : ["projects", "interactions", "account"]
            ).map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {title(t)}
              </button>
            ))}
          </nav>
          {tab === "profile" &&
            (v.profile ? (
              <Card title="Complete business profile">
                <div className="admin-business-media">
                  {(v.profile.images || []).map((i) => (
                    <figure key={i.id}>
                      {i.url ? (
                        <a href={i.url} target="_blank" rel="noreferrer">
                          <img
                            src={i.url}
                            alt={
                              i.slot === "logo"
                                ? "Business logo"
                                : "Business advertising image"
                            }
                          />
                        </a>
                      ) : (
                        <p>
                          <ImageIcon /> Image storage unavailable
                        </p>
                      )}
                      <figcaption>{title(i.slot)}</figcaption>
                    </figure>
                  ))}
                </div>
                <h3>{v.profile.business}</h3>
                <p className="admin-prose">{v.profile.bio}</p>
                <Facts
                  data={{
                    category: v.profile.category,
                    services: v.profile.serviceCategories,
                    startingHourlyRateUSD: v.profile.rate,
                    rating: v.profile.rating,
                    reviewCount: v.profile.reviewCount,
                    privateBusinessAddress: v.profile.address,
                    zip: v.profile.zip,
                    serviceRadiusMiles: v.profile.serviceRadiusMiles,
                    available: v.profile.available,
                    timeZone: v.profile.timeZone,
                    weeklyHours: v.profile.weeklyHours,
                    ...v.profile.details,
                  }}
                />
              </Card>
            ) : (
              <Card title="Business profile">
                <p className="admin-empty">
                  This account has no saved business profile.
                </p>
              </Card>
            ))}
          {tab === "identity" && (
            <Card title="Identity verification">
              <Status
                value={v.profile?.verified ? "verified" : "not verified"}
              />
              <p>
                Stripe verifies the account holder. This does not verify
                business registration, licensing or insurance. Administrators
                cannot mark an identity verified here.
              </p>
              <p className="admin-muted">
                Identity documents and selfies remain with Stripe; they are not
                available as Aplime files.
              </p>
              <Loading error={provider.error} loading={provider.loading} />
              {provider.value && <Facts data={provider.value} />}
            </Card>
          )}
          {tab === "membership" && (
            <Card title="Membership and subscription">
              {v.membership ? (
                <Facts data={v.membership} />
              ) : (
                <p>No subscription record.</p>
              )}
              <p className="admin-muted">
                Stored Stripe-confirmed status. Subscription payment methods are
                managed through Stripe, and service payments are arranged
                directly between participants.
              </p>
              <h3>Current Stripe details</h3>
              <Loading error={provider.error} loading={provider.loading} />
              {provider.value && <Facts data={provider.value} />}
            </Card>
          )}
          {tab === "review" && (
            <Card title="Marketplace review">
              {v.profile ? (
                <>
                  <Status value={v.profile.reviewStatus} />
                  <Facts
                    data={{
                      listed: v.profile.listed,
                      suspended: v.profile.suspended,
                      identityVerified: v.profile.verified,
                      submittedAt: v.profile.submittedAt,
                      reviewedAt: v.profile.reviewedAt,
                      reviewNote: v.profile.reviewNote,
                    }}
                  />
                  {v.profile.listed && v.profile.reviewStatus === "pending" && (
                    <p className="admin-banner">
                      This previously approved listing remains live while its
                      edits are reviewed.
                    </p>
                  )}
                  {v.profile.reviewStatus === "pending" && (
                    <>
                      <label>
                        Review explanation
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={2000}
                          placeholder="Explain required changes or rejection (at least 10 characters)."
                        />
                      </label>
                      <div className="admin-actions">
                        {[
                          ["approved", "Approve listing"],
                          ["changes_requested", "Request changes"],
                          ["rejected", "Reject listing"],
                        ].map(([status, label]) => (
                          <button
                            disabled={
                              busy ||
                              (status !== "approved" && note.trim().length < 10)
                            }
                            key={status}
                            onClick={() => void review(status)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    className="admin-danger"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await request("/profiles/" + encodeURIComponent(id), {
                          suspended: !v.profile!.suspended,
                        });
                        go("professionals");
                      })
                    }
                  >
                    {v.profile.suspended
                      ? "Restore marketplace access"
                      : "Suspend marketplace access"}
                  </button>
                </>
              ) : (
                <p>No business profile to review.</p>
              )}
            </Card>
          )}
          {tab === "projects" && (
            <Collection
              page="projects"
              userId={id}
              request={request}
              revision={revision}
              go={go}
            />
          )}{" "}
          {tab === "interactions" && (
            <Interactions
              request={request}
              revision={revision}
              go={go}
              userId={id}
            />
          )}
          {tab === "account" && (
            <Card title="Account information">
              <Facts
                data={{
                  id: v.user.id,
                  name: v.user.name,
                  email: v.user.email,
                  role: v.user.role,
                  createdAt: v.user.createdAt,
                  settings: v.user.settings,
                }}
              />
              <p className="admin-muted">
                Passwords, authenticator secrets and private provider
                credentials are never returned.
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
function ProjectDetail({
  id,
  request,
  revision,
  go,
}: {
  id: string;
  request: Requester;
  revision: unknown;
  go: (p: string, id?: string) => void;
}) {
  const { value: v, ...state } = useRemote<{ project: Project }>(
    "/projects/" + id,
    request,
    revision,
  );
  const [tab, setTab] = useState("details"),
    [page, setPage] = useState(1),
    [conversation, setConversation] = useState("");
  const [file, setFile] = useState<{
      url: string;
      name: string;
      previewUrl?: string | null;
    } | null>(null),
    [fileError, setFileError] = useState("");
  const path = conversation
    ? `/conversations/${conversation}?page=${page}`
    : `/projects/${id}/records/${tab === "details" ? "activity" : tab}?page=${page}`;
  const records = useRemote<RecordPage>(path, request, revision);
  const open = (r: RecordRow) => {
    if (tab === "conversations") {
      setConversation(String(r.id));
      setPage(1);
    }
    if (tab === "files") {
      setFile(null);
      setFileError("");
      void request<{ url: string; name: string; previewUrl?: string | null }>(
        "/files/" + r.id,
      )
        .then(setFile)
        .catch((e) => setFileError(e.message));
    }
  };
  return (
    <>
      <Loading {...state} />
      {v && (
        <>
          <div className="admin-detail-heading">
            <div>
              <span className="admin-eyebrow">Project {v.project.id}</span>
              <h2>{v.project.title}</h2>
              <Status value={v.project.status} />
            </div>
            <div className="admin-actions">
              <button onClick={() => go("users", v.project.customerId)}>
                Customer
              </button>
              {v.project.proId && (
                <button onClick={() => go("professionals", v.project.proId!)}>
                  Professional
                </button>
              )}
            </div>
          </div>
          <nav className="admin-tabs" aria-label="Project details">
            {[
              "details",
              "activity",
              "estimates",
              "conversations",
              "files",
              "reviews",
              "calls",
              "legacy",
            ].map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                  setConversation("");
                  setFile(null);
                }}
              >
                {t === "legacy" ? "Historical messages" : title(t)}
              </button>
            ))}
          </nav>
          {tab === "details" ? (
            <Card title="Full project details">
              <p className="admin-prose">{v.project.description}</p>
              <Facts data={v.project} />
            </Card>
          ) : (
            <Card title={conversation ? "Conversation transcript" : title(tab)}>
              {conversation && (
                <button
                  onClick={() => {
                    setConversation("");
                    setPage(1);
                  }}
                >
                  <ArrowLeft size={15} /> All conversations
                </button>
              )}
              {tab === "calls" && (
                <p className="admin-muted">
                  Call invitations from this release only. Calls are not
                  recorded; connection and duration are not available.
                </p>
              )}
              {file && (
                <p className="admin-banner">
                  File link ready:{" "}
                  <a href={file.url} target="_blank" rel="noreferrer">
                    Download {file.name} <ExternalLink size={14} />
                  </a>{" "}
                  · expires shortly.
                </p>
              )}
              {fileError && (
                <p className="error" role="alert">
                  {fileError}
                </p>
              )}
              {file?.previewUrl && (
                <figure className="admin-file-preview">
                  <img src={file.previewUrl} alt={file.name} />
                  <figcaption>{file.name}</figcaption>
                </figure>
              )}
              <Loading error={records.error} loading={records.loading} />
              {records.value && (
                <>
                  <Table
                    rows={records.value.rows}
                    open={
                      !conversation && ["conversations", "files"].includes(tab)
                        ? open
                        : undefined
                    }
                  />
                  <Pager {...records.value} onChange={setPage} />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
function SupportInbox({
  id,
  request,
  revision,
  run,
  busy,
  go,
}: {
  id: string;
  request: Requester;
  revision: unknown;
  run: Runner;
  busy: boolean;
  go: (p: string, id?: string) => void;
}) {
  const [page, setPage] = useState(1),
    [tick, setTick] = useState(0),
    [body, setBody] = useState(""),
    [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const create = id.startsWith("new:"),
    [messagePage, setMessagePage] = useState(1);
  useEffect(() => {
    if (!id || create) return;
    const t = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(t);
  }, [id]);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [revision]);
  const list = useRemote<{
    rows: SupportTicket[];
    total: number;
    page: number;
    pageSize: number;
  }>("/support/conversations?page=" + page, request, revision, !id);
  const thread = useRemote<SupportThread>(
    "/support/conversations/" +
      (id && !create ? id : "00000000-0000-4000-8000-000000000000") +
      "?page=" +
      messagePage,
    request,
    tick,
    !!id && !create,
  );
  if (create)
    return (
      <Card title="Start a conversation with this user">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const t = await request<{ id: string }>(
                "/support/conversations",
                {
                  userId: id.slice(4),
                  subject: f.get("subject"),
                  body: f.get("body"),
                },
              );
              go("support", t.id);
            });
          }}
        >
          <label>
            Subject
            <input name="subject" required minLength={5} maxLength={120} />
          </label>
          <label>
            Message
            <textarea name="body" required minLength={10} maxLength={4000} />
          </label>
          <button disabled={busy}>Send to user</button>
        </form>
      </Card>
    );
  if (!id)
    return (
      <Card title="Support conversations">
        <Loading {...list} />
        {list.value && (
          <>
            <div className="admin-support-list">
              {list.value.rows.map((t) => (
                <button
                  className="admin-thread-row"
                  key={t.id}
                  onClick={() => go("support", t.id)}
                >
                  <MessageCircle />
                  <span>
                    <strong>{t.subject}</strong>
                    <small>
                      {t.userName} · {t.userEmail}
                    </small>
                    <small>
                      {t.messageCount} replies · {date(t.updatedAt)}
                    </small>
                  </span>
                  <Status value={t.status} />
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            {!list.value.rows.length && (
              <p className="admin-empty">
                No support conversations. Open a user’s account to contact them.
              </p>
            )}
            <Pager {...list.value} onChange={setPage} />
          </>
        )}
      </Card>
    );
  const t = thread.value?.ticket;
  return (
    <>
      <Loading error={thread.error} loading={!thread.value && thread.loading} />
      {t && (
        <Card title={t.subject} aside={<Status value={t.status} />}>
          <button onClick={() => go("users", t.userId)}>
            View {t.userName}’s account
          </button>
          <div
            className="admin-chat"
            role="log"
            aria-label="Support conversation"
          >
            <article>
              <strong>{t.openedByName}</strong>
              <p>{t.body}</p>
              <small>{date(t.createdAt)}</small>
            </article>
            {thread.value!.messages.map((m) => (
              <article
                className={m.senderRole === "admin" ? "from-admin" : ""}
                key={m.id}
              >
                <strong>
                  {m.senderName}
                  {m.senderRole === "admin" ? " · Aplime support" : ""}
                </strong>
                <p>{m.body}</p>
                <small>{date(m.createdAt)}</small>
              </article>
            ))}
          </div>
          <Pager
            page={thread.value!.page}
            total={thread.value!.total}
            pageSize={50}
            onChange={setMessagePage}
          />
          {t.resolution && (
            <p className="admin-banner">Resolution: {t.resolution}</p>
          )}
          {t.status === "open" ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await request(
                      "/support/conversations/" + id + "/messages",
                      { body, clientKey },
                    );
                    setBody("");
                    setClientKey(crypto.randomUUID());
                    setMessagePage(1);
                    setTick((t) => t + 1);
                  });
                }}
              >
                <label>
                  Reply to user
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    maxLength={4000}
                  />
                </label>
                <button disabled={busy || !body.trim()}>Send reply</button>
              </form>
              <details>
                <summary>Resolve conversation</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      await request("/tickets/" + id, {
                        resolution: f.get("resolution"),
                        refund: false,
                      });
                      setTick((t) => t + 1);
                    });
                  }}
                >
                  <label>
                    Resolution summary
                    <textarea
                      name="resolution"
                      minLength={10}
                      maxLength={3000}
                      required
                    />
                  </label>
                  <button disabled={busy}>Mark resolved</button>
                </form>
              </details>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request("/support/conversations/" + id + "/reopen", {});
                  setTick((t) => t + 1);
                })
              }
            >
              Reopen conversation
            </button>
          )}
        </Card>
      )}
    </>
  );
}
function Updates({
  request,
  revision,
  run,
  busy,
  refresh,
  go,
}: {
  request: Requester;
  revision: unknown;
  run: Runner;
  busy: boolean;
  refresh: () => Promise<void>;
  go: (p: string, id?: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { value, ...state } = useRemote<RecordPage>(
    "/notifications?page=" + page,
    request,
    revision,
  );
  return (
    <Card title="Administrator notifications">
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await request("/notifications/read", {});
            await refresh();
          })
        }
      >
        Mark all read
      </button>
      <Loading {...state} />
      {value && (
        <>
          {value.rows.map((n) => (
            <article className="admin-notice" key={String(n.id)}>
              <Status value={n.read ? "read" : "unread"} />
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{date(n.createdAt)}</small>
              <div>
                <button
                  onClick={() =>
                    go(
                      n.targetPage === "project"
                        ? "projects"
                        : items.some((i) => i[0] === n.targetPage)
                          ? String(n.targetPage)
                          : "overview",
                      n.targetId ? String(n.targetId) : "",
                    )
                  }
                >
                  Open related page <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
          {!value.rows.length && (
            <p className="admin-empty">No notifications yet.</p>
          )}
          <Pager {...value} onChange={setPage} />
        </>
      )}
    </Card>
  );
}
export function AdminConsole({
  session,
  request,
  run,
  busy,
  refresh,
}: {
  session: AdminSession;
  request: Requester;
  run: Runner;
  busy: boolean;
  refresh: () => Promise<void>;
}) {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const changed = () => setRoute(readRoute());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const go = (page: string, id = "") => {
    location.hash = "/" + page + (id ? "/" + encodeURIComponent(id) : "");
  };
  const label = items.find((i) => i[0] === route.page)?.[1] || "Overview";
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-intro">
          <span className="admin-eyebrow">OPERATIONS WORKSPACE</span>
          <p>Everything in view.</p>
        </div>
        <nav aria-label="Administration">
          {items.map(
            ([page, label, Icon]) =>
              !["identity", "memberships"].includes(page) && (
                <div key={page}>
                  <button
                    key={page}
                    aria-current={
                      route.page === page ||
                      (page === "professionals" &&
                        ["identity", "memberships"].includes(route.page))
                        ? "page"
                        : undefined
                    }
                    onClick={() => go(page)}
                  >
                    <Icon size={18} />
                    {label}
                    {page === "updates" && session.unreadCount > 0 && (
                      <b>{session.unreadCount}</b>
                    )}
                  </button>
                  {page === "professionals" &&
                    ["professionals", "identity", "memberships"].includes(
                      route.page,
                    ) && (
                      <div
                        className="admin-business-nav"
                        role="group"
                        aria-label="Business management"
                      >
                        {items
                          .filter((i) =>
                            [
                              "professionals",
                              "identity",
                              "memberships",
                            ].includes(i[0]),
                          )
                          .map(([p, label]) => (
                            <button
                              key={p}
                              aria-current={
                                route.page === p ? "page" : undefined
                              }
                              onClick={() => go(p)}
                            >
                              {p === "professionals"
                                ? "Profiles & marketplace review"
                                : label}
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              ),
          )}
        </nav>
        <div className="admin-sidebar-person">
          <span>{session.user.name.slice(0, 1)}</span>
          <div>
            <strong>{session.user.name}</strong>
            <small>Authorized administrator</small>
          </div>
        </div>
      </aside>
      <div className="admin-content">
        <div className="admin-page-heading">
          <div>
            <span className="admin-eyebrow">APLIME ADMINISTRATION</span>
            <h1>{label}</h1>
            <p>
              Manage the marketplace with a clear view of its people and work.
            </p>
          </div>
          <button disabled={busy} onClick={() => void run(refresh)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {route.id && (
          <button className="admin-back" onClick={() => go(route.page)}>
            <ArrowLeft size={16} /> Back to {label.toLowerCase()}
          </button>
        )}
        <div key={route.page + ":" + route.id}>
          {route.page === "overview" ? (
            <Overview request={request} revision={session} go={go} />
          ) : route.page === "support" ? (
            <SupportInbox
              id={route.id}
              request={request}
              revision={session}
              run={run}
              busy={busy}
              go={go}
            />
          ) : route.page === "interactions" ? (
            <Interactions request={request} revision={session} go={go} />
          ) : route.page === "updates" ? (
            <Updates
              request={request}
              revision={session}
              run={run}
              busy={busy}
              refresh={refresh}
              go={go}
            />
          ) : route.id ? (
            route.page === "projects" ? (
              <ProjectDetail
                id={route.id}
                request={request}
                revision={session}
                go={go}
              />
            ) : (
              <UserDetail
                id={route.id}
                request={request}
                revision={session}
                run={run}
                busy={busy}
                go={go}
                initialTab={
                  route.page === "identity"
                    ? "identity"
                    : route.page === "memberships"
                      ? "membership"
                      : "profile"
                }
              />
            )
          ) : (
            <Collection
              page={route.page}
              request={request}
              revision={session}
              go={go}
            />
          )}
        </div>
        <p className="admin-data-note">
          <ShieldCheck size={15} /> Detailed account, project, transcript and
          file access is recorded in the audit trail.
        </p>
      </div>
    </div>
  );
}
