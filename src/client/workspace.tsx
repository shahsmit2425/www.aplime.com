import { ProjectIntake } from "./project-intake.js";
import { hasIntakeResume } from "./project-intake-state.js";
import { NotificationDropdown } from "./notification-dropdown.js";
import { MeetingProvider } from "./meeting-state.js";
import { watchNotifications } from "./live-notifications.js";
import type { Notice } from "../shared/domain.js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  House,
  Search,
  BriefcaseBusiness,
  FileText,
  CalendarDays,
  MessageCircle,
  CreditCard,
  Star,
  UserRound,
  Clock,
  Users,
  ShieldCheck,
  Bell,
  Settings,
  HelpCircle,
  Menu,
  X,
  LogOut,
  Heart,
} from "lucide-react";
import type { Workspace as Data } from "../shared/domain.js";
import { fallbackConfig } from "../shared/config.js";
import {
  auth,
  login,
  register,
  google,
  apple,
  logout,
  recover,
  verifyEmail,
  configureSession,
  authErrorMessage,
} from "./auth.js";
import { request, ApiError } from "./api.js";
import { Brand, Field, Form } from "./ui.js";
import { Pages } from "./pages.js";
import { pageAfterAuthentication } from "./onboarding.js";
type WorkspaceContext = {
  data: Data;
  page: string;
  id?: string;
  go: (page: string, id?: string) => void;
  run: (
    fn: () => Promise<unknown>,
    message?: string,
    after?: () => void,
  ) => Promise<void>;
  busy: boolean;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const c = useContext(Context);
  if (!c) throw new Error("Workspace unavailable");
  return c;
}
function readRoute() {
  const part = Capacitor.isNativePlatform()
    ? location.hash.replace(/^#\/?/, "")
    : location.pathname.replace(/^\/app\/?/, "");
  const [page, id] = part.split("/");
  return {
    page: page || "dashboard",
    id: id ? decodeURIComponent(id) : undefined,
  };
}
const navIcons: Record<string, typeof House> = {
  dashboard: House,
  discover: Search,
  projects: BriefcaseBusiness,
  quotes: FileText,
  schedule: CalendarDays,
  messages: MessageCircle,
  payments: CreditCard,
  earnings: CreditCard,
  subscription: CreditCard,
  reviews: Star,
  profile: UserRound,
  verification: ShieldCheck,
  availability: Clock,
  people: Users,
  reports: ShieldCheck,
  notifications: Bell,
  settings: Settings,
  help: HelpCircle,
  saved: Heart,
  leads: Search,
};
const navigation = {
  customer: [
    ["dashboard", "Dashboard"],
    ["projects", "Post project"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["saved", "Saved pros"],
    ["reviews", "My reviews"],
  ],
  pro: [
    ["dashboard", "Dashboard"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["profile", "My business"],
    ["reviews", "Reviews"],
  ],
  admin: [],
};
function RoleChoice({
  value,
  onChange,
}: {
  value: "customer" | "pro";
  onChange: (role: "customer" | "pro") => void;
}) {
  return (
    <div className="role-choice" role="radiogroup" aria-label="Account type">
      <button
        type="button"
        role="radio"
        aria-checked={value === "customer"}
        className={
          value === "customer" ? "role-option selected" : "role-option"
        }
        onClick={() => onChange("customer")}
      >
        <House size={22} />
        <span>
          <strong>Customer</strong>
          <small>Find and manage help for your home</small>
        </span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "pro"}
        className={value === "pro" ? "role-option selected" : "role-option"}
        onClick={() => onChange("pro")}
      >
        <BriefcaseBusiness size={22} />
        <span>
          <strong>Professional</strong>
          <small>Offer services and manage your work</small>
        </span>
      </button>
    </div>
  );
}
export default function Workspace() {
  const [route, setRoute] = useState(readRoute),
    [signupRole, setSignupRole] = useState<"customer" | "pro">(() =>
      !hasIntakeResume() &&
      new URLSearchParams(location.search).get("role") === "pro"
        ? "pro"
        : "customer",
    ),
    [resendUntil, setResendUntil] = useState(0),
    [remember, setRemember] = useState(true),
    [authEmail, setAuthEmail] = useState(""),
    [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [needsAccount, setNeedsAccount] = useState(false),
    [menu, setMenu] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [headerHeight, setHeaderHeight] = useState(110);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () =>
      setHeaderHeight(
        header.offsetHeight +
          (document.querySelector<HTMLElement>(".environment-bar")
            ?.offsetHeight || 0),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    const wide = window.matchMedia("(min-width: 851px)");
    const closeMobileNavigation = () => {
      if (wide.matches) setMenu(false);
    };
    wide.addEventListener("change", closeMobileNavigation);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", closeMobileNavigation);
    };
  }, [!!data]);
  useEffect(() => {
    if (data && route.page === "notifications") {
      replaceRoute("dashboard");
      setNotificationsOpen(true);
    }
  }, [route.page, !!data]);
  const [liveConnected, setLiveConnected] = useState(false);
  const loadSequence = useRef(0);
  const lastLoadAt = useRef(0);
  const [liveNotice, setLiveNotice] = useState<Notice | null>(null);
  const knownNotices = useRef<{ user: string; ids: Set<string> }>({
    user: "",
    ids: new Set(),
  });
  useEffect(() => {
    if (!data) {
      knownNotices.current = { user: "", ids: new Set() };
      setLiveNotice(null);
      return;
    }
    const previous = knownNotices.current;
    if (previous.user === data.user.id) {
      const fresh = data.notices.find(
        (n) => !n.read && !previous.ids.has(n.id),
      );
      if (fresh) setLiveNotice(fresh);
    }
    knownNotices.current = {
      user: data.user.id,
      ids: new Set(data.notices.map((n) => n.id)),
    };
  }, [data]);
  useEffect(() => {
    if (!liveNotice) return;
    const timer = setTimeout(() => setLiveNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [liveNotice]);
  useEffect(() => {
    if (!data) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false,
      again = false,
      disposed = false;
    const refresh = async () => {
      if (pending) {
        again = true;
        return;
      }
      pending = true;
      try {
        await load();
        if (!disposed) window.dispatchEvent(new Event("aplime:updates"));
      } catch {
      } finally {
        pending = false;
        if (again && !disposed) {
          again = false;
          timer = setTimeout(() => void refresh(), 200);
        }
      }
    };
    const stop = watchNotifications(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 150);
    }, setLiveConnected);
    return () => {
      disposed = true;
      stop();
      clearTimeout(timer);
      setLiveConnected(false);
    };
  }, [data?.user.id]);
  function replaceRoute(page: string) {
    if (Capacitor.isNativePlatform()) location.hash = "/" + page;
    else history.replaceState({}, "", "/app/" + page);
    setRoute(readRoute());
  }
  function chooseSignupRole(role: "customer" | "pro") {
    setSignupRole(role);
    if (!Capacitor.isNativePlatform() && route.page === "register") {
      const url = new URL(location.href);
      url.searchParams.set("role", role);
      history.replaceState({}, "", url);
    }
  }
  function go(page: string, id?: string) {
    if (page === "notifications") {
      setNotificationsOpen(true);
      setMenu(false);
      return;
    }
    setNotificationsOpen(false);
    const path = page + (id ? "/" + encodeURIComponent(id) : "");
    if (Capacitor.isNativePlatform()) location.hash = "/" + path;
    else {
      history.pushState({}, "", "/app/" + path);
      setRoute(readRoute());
    }
    setMenu(false);
    setError("");
    setNotice("");
    window.scrollTo(0, 0);
  }
  async function load() {
    const owner = auth().currentUser;
    if (!owner) return;
    const sequence = ++loadSequence.current;
    lastLoadAt.current = Date.now();
    try {
      const result = await request<Data>("/workspace");
      if (auth().currentUser !== owner || sequence !== loadSequence.current)
        return;
      if (result.user.role === "admin")
        throw new Error("Use the separate administrator application.");
      setData(result);
      setNeedsAccount(false);
      const current = readRoute().page;
      const next = pageAfterAuthentication(
        current,
        result.user.role,
        result.profiles.some((p) => p.id === result.user.id),
      );
      if (
        hasIntakeResume() &&
        result.user.role === "customer" &&
        ["login", "register", "recovery"].includes(current)
      )
        replaceRoute("projects/resume");
      else if (next !== current) replaceRoute(next);
    } catch (e) {
      if (auth().currentUser !== owner || sequence !== loadSequence.current)
        return;
      if (e instanceof ApiError && e.status === 401) {
        await logout();
        replaceRoute("login");
        setNotice("Your session has ended. Please sign in again.");
        return;
      }
      if (e instanceof ApiError && e.status === 428) {
        setNeedsAccount(true);
        setData(null);
      } else throw e;
    }
  }
  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth(), (u) => {
        setLoading(true);
        setFirebaseUser(u);
        setData(null);
        setNeedsAccount(false);
        if (u && u.emailVerified)
          void load()
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        else setLoading(false);
      });
    } catch (e) {
      setError(authErrorMessage(e));
      setLoading(false);
    }
    return () => {
      unsub();
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    // While the live stream is connected it announces every change, so polling
    // is only a slow safety net; without it, keep the fast fallback.
    const interval = liveConnected ? 60000 : 10000;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoadAt.current >= interval / 2
      )
        void load().catch(() => {});
    };
    const timer = setInterval(refresh, interval);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.user.id, liveConnected]);
  useEffect(() => {
    if (!menu || !data) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const drawer = document.querySelector<HTMLElement>(".drawer");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [menu, !!data]);
  const verificationPending = useRef(false);
  async function checkVerification() {
    const user = auth().currentUser;
    if (!user || verificationPending.current) return false;
    verificationPending.current = true;
    try {
      await user.reload();
      if (auth().currentUser !== user || !user.emailVerified) return false;
      await user.getIdToken(true);
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
      return true;
    } finally {
      verificationPending.current = false;
    }
  }
  useEffect(() => {
    if (!firebaseUser || firebaseUser.emailVerified || data || needsAccount)
      return;
    const check = () => {
      if (document.visibilityState === "visible")
        void checkVerification().catch(() => {});
    };
    const timer = setInterval(check, 5000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [firebaseUser, data, needsAccount]);
  useEffect(() => {
    if (!resendUntil) return;
    const timer = setTimeout(
      () => setResendUntil(0),
      Math.max(0, resendUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [resendUntil]);
  async function run(
    fn: () => Promise<unknown>,
    message = "Saved.",
    after?: () => void,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (auth().currentUser?.emailVerified) await load();
      after?.();
      if (message) setNotice(message);
    } catch (e) {
      setError(authErrorMessage(e));
      if (e instanceof ApiError && e.status === 409)
        await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  function signOutToLogin() {
    setMenu(false);
    void run(async () => {
      await logout();
      replaceRoute("login");
    }, "Your account is saved. Sign in to continue verification or setup.");
  }
  const config = window.__CONFIG__ || fallbackConfig;
  if (loading)
    return (
      <div className="auth-page auth-loading-page" role="status">
        <Brand />
        <div className="auth-loader" aria-hidden="true" />
        <div>
          <h1>Opening your Aplime account…</h1>
          <p>Checking your secure session.</p>
        </div>
      </div>
    );
  if (!data && route.page === "projects")
    return (
      <div className="guest-intake-page">
        <header className="guest-intake-header">
          <Brand />
          <span>Plan your project · Sign in at the final step</span>
        </header>
        <main>
          <ProjectIntake
            onAuthenticate={() => {
              setSignupRole("customer");
              go("login");
            }}
            onPublished={async () => {}}
          />
        </main>
        <footer>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Service information</a>
        </footer>
      </div>
    );
  if (!data)
    return (
      <div className="auth-page">
        <Brand />
        <section className="auth-card">
          <p className="eyebrow">WELCOME TO APLIME</p>
          {hasIntakeResume() && (
            <div className="intake-auth-notice">
              <strong>Your project is ready.</strong>
              <p>
                Sign in to review and publish it. Your answers and photos are
                saved in this tab.
              </p>
              <button
                className="text-button"
                onClick={() => go("projects", "resume")}
              >
                Back to project answers
              </button>
            </div>
          )}
          <h1>
            {needsAccount
              ? `Finish setting up your ${signupRole === "pro" ? "professional" : "customer"} account.`
              : firebaseUser && !firebaseUser.emailVerified
                ? "Check your inbox."
                : route.page === "register"
                  ? "Create your Aplime account."
                  : route.page === "recovery"
                    ? "Let’s get you back in."
                    : "Sign in to your account."}
          </h1>
          {(route.page === "register" ||
            (firebaseUser && !firebaseUser.emailVerified) ||
            needsAccount) && (
            <ol className="auth-steps" aria-label="Registration progress">
              <li
                className={
                  route.page === "register" && !firebaseUser
                    ? "current"
                    : "complete"
                }
              >
                <span>1</span> Account
              </li>
              <li
                className={
                  firebaseUser && !firebaseUser.emailVerified
                    ? "current"
                    : needsAccount
                      ? "complete"
                      : ""
                }
              >
                <span>2</span> Verify
              </li>
              <li className={needsAccount ? "current" : ""}>
                <span>3</span> Profile
              </li>
            </ol>
          )}
          {firebaseUser && !firebaseUser.emailVerified ? (
            <>
              <p>
                Verify your email using the link we sent to {firebaseUser.email}
                . We’ll continue automatically when verification is confirmed.
                You can also check below.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const verified = await checkVerification();
                    if (!verified)
                      setNotice(
                        "Not verified yet. Open the latest email link, then try again. Check your spam folder too.",
                      );
                  }, "")
                }
              >
                I’ve verified my email
              </button>
              <button
                className="secondary"
                disabled={busy || resendUntil > Date.now()}
                onClick={() =>
                  void run(async () => {
                    await verifyEmail(firebaseUser);
                    setResendUntil(Date.now() + 60000);
                  }, "Verification email sent.")
                }
              >
                {resendUntil > Date.now()
                  ? "Email sent — wait a minute to resend"
                  : "Resend verification email"}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={signOutToLogin}
              >
                Use a different account
              </button>
            </>
          ) : needsAccount ? (
            <Form
              busy={busy}
              onSubmit={(f) =>
                run(
                  () =>
                    request("/account", {
                      name: f.get("name"),
                      role: f.get("role"),
                    }),
                  "Account created.",
                )
              }
            >
              <Field label="Your name">
                <input
                  name="name"
                  minLength={2}
                  maxLength={80}
                  required
                  autoComplete="name"
                />
              </Field>
              <fieldset className="role-field">
                <legend>I’m here to</legend>
                <input type="hidden" name="role" value={signupRole} />
                {hasIntakeResume() ? (
                  <p>Customer account · Find help for your project</p>
                ) : (
                  <RoleChoice value={signupRole} onChange={chooseSignupRole} />
                )}
              </fieldset>
              <p className="muted">
                Professionals complete a business profile and identity
                verification before their listing appears.
              </p>
              <button>Create account</button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={signOutToLogin}
              >
                Sign out
              </button>
            </Form>
          ) : firebaseUser ? (
            <>
              <p>
                Your account could not be loaded. Check the connection and
                retry.
              </p>
              <button onClick={() => void run(load, "")}>Retry</button>
              <button className="text-button" onClick={signOutToLogin}>
                Sign out
              </button>
            </>
          ) : (
            <>
              {route.page === "register" && (
                <>
                  <p className="auth-intro">
                    Choose how you plan to use Aplime. You can’t change the
                    account type after finishing registration.
                  </p>
                  {hasIntakeResume() ? (
                    <p>Customer account · Find help for your project</p>
                  ) : (
                    <RoleChoice
                      value={signupRole}
                      onChange={chooseSignupRole}
                    />
                  )}
                </>
              )}
              {route.page === "login" && (
                <p className="auth-intro">
                  Pick up where you left off. We’ll open your account or help
                  you finish verification automatically.
                </p>
              )}
              <Form
                busy={busy}
                onSubmit={(f) =>
                  run(
                    async () => {
                      const email = String(f.get("email"));
                      if (route.page === "recovery") {
                        await recover(email);
                        return;
                      }
                      await configureSession(remember);
                      if (route.page === "register")
                        await register(email, String(f.get("password")));
                      else await login(email.trim(), String(f.get("password")));
                    },
                    route.page === "recovery"
                      ? "If an account exists, a recovery email will arrive shortly."
                      : "",
                  )
                }
              >
                <Field label="Email address">
                  <input
                    type="email"
                    name="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>
                {route.page !== "recovery" && (
                  <Field label="Password">
                    <input
                      type="password"
                      name="password"
                      minLength={route.page === "register" ? 12 : 1}
                      required
                      autoComplete={
                        route.page === "register"
                          ? "new-password"
                          : "current-password"
                      }
                    />
                  </Field>
                )}
                {route.page !== "recovery" && !Capacitor.isNativePlatform() && (
                  <label className="session-choice">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>
                      Keep me signed in
                      <small>
                        Uncheck on a shared device to use this tab only.
                      </small>
                    </span>
                  </label>
                )}
                <button>
                  {route.page === "register"
                    ? "Create your account"
                    : route.page === "recovery"
                      ? "Send recovery email"
                      : "Sign in"}
                </button>
              </Form>
              {route.page !== "recovery" && (
                <div className="social-login">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await configureSession(remember);
                        await google();
                      }, "")
                    }
                  >
                    Continue with Google
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await configureSession(remember);
                        await apple();
                      }, "")
                    }
                  >
                    Continue with Apple
                  </button>
                </div>
              )}
              <div className="auth-links">
                <button
                  className="text-button"
                  onClick={() =>
                    go(route.page === "register" ? "login" : "register")
                  }
                >
                  {route.page === "register"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"}
                </button>
                <button className="text-button" onClick={() => go("recovery")}>
                  Forgot password?
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="alert" role="status">
              {notice}
            </p>
          )}
          <p className="auth-foot">
            Your projects. Your conversations. All together.
          </p>
        </section>
        <a href="/">Back to home</a>
      </div>
    );
  const links = [
    ...navigation[data.user.role],
    ["settings", "Settings"],
    ["help", "Help & safety"],
  ];
  const renderLinks = (items: string[][]) =>
    items.map(([p, label]) => {
      const Icon = navIcons[p];
      const active =
        (data.user.role === "customer" && p === "dashboard"
          ? route.page === "dashboard" ||
            route.page === "project" ||
            (route.page === "projects" && !route.id)
          : data.user.role === "customer" && p === "projects"
            ? route.page === "projects" && !!route.id
            : data.user.role === "pro" && p === "dashboard"
              ? [
                  "dashboard",
                  "project",
                  "projects",
                  "leads",
                  "quotes",
                ].includes(route.page)
              : route.page === p) ||
        (data.user.role === "pro" &&
          p === "profile" &&
          [
            "verification",
            "subscription",
            "availability",
            "onboarding",
            "payments",
            "earnings",
          ].includes(route.page));
      return (
        <button
          key={p}
          className={active ? "nav-link active" : "nav-link"}
          aria-current={active ? "page" : undefined}
          onClick={() =>
            go(
              p,
              data.user.role === "customer" && p === "projects"
                ? "new"
                : undefined,
            )
          }
        >
          <Icon size={19} />
          {label}
          {p === "messages" && !!data.unreadMessageCount && (
            <span
              className="notification-count"
              aria-label={`${data.unreadMessageCount} unread conversation updates`}
            >
              {data.unreadMessageCount > 99 ? "99+" : data.unreadMessageCount}
            </span>
          )}
        </button>
      );
    });
  const dashboardBrand = (
    <Brand
      href={Capacitor.isNativePlatform() ? "#/dashboard" : "/app/dashboard"}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        go("dashboard");
      }}
    />
  );
  const nav = (
    <>
      {dashboardBrand}
      <p className="workspace-label">
        {data.user.role === "pro" ? "YOUR BUSINESS" : "YOUR HOME, ORGANIZED"}
      </p>
      <nav aria-label="Workspace navigation">{renderLinks(links)}</nav>
      <div className="sidebar-person">
        <span className="avatar">{data.user.name.slice(0, 1)}</span>
        <div>
          <strong>{data.user.name}</strong>
          <small>
            {data.user.role === "pro" ? "Professional" : "Customer"}
          </small>
        </div>
        <button
          aria-label="Sign out"
          className="icon-button"
          onClick={signOutToLogin}
        >
          <LogOut size={18} />
        </button>
      </div>
    </>
  );
  return (
    <Context.Provider
      value={{ data, page: route.page, id: route.id, go, run, busy }}
    >
      <MeetingProvider key={data.user.id} userId={data.user.id}>
        <div
          className="workspace"
          style={
            {
              "--workspace-header-height": `${headerHeight}px`,
            } as CSSProperties
          }
        >
          <a className="skip-link" href="#workspace-content">
            Skip to content
          </a>
          <div className="workspace-body">
            {config.environment !== "production" && (
              <div className="environment-bar">
                {config.environment === "stagging" ? "Staging" : "Development"}{" "}
                environment
              </div>
            )}
            <header
              className={
                "topbar workspace-header" +
                (data.user.role === "pro" ? " professional-header" : "")
              }
              ref={headerRef}
            >
              {dashboardBrand}
              <nav
                className="workspace-primary-nav"
                aria-label="Main navigation"
              >
                {renderLinks(
                  links.filter(([p]) => !["notifications", "help"].includes(p)),
                )}
              </nav>
              <div className="actions">
                <button
                  className="icon-button workspace-menu"
                  aria-label="Open navigation"
                  aria-expanded={menu}
                  onClick={() => setMenu(true)}
                >
                  <Menu size={21} />
                </button>
                <NotificationDropdown
                  open={notificationsOpen}
                  setOpen={setNotificationsOpen}
                  notices={data.notices}
                  unread={data.unreadCount || 0}
                  connected={liveConnected}
                  busy={busy}
                  run={run}
                  go={go}
                />
                <button
                  type="button"
                  className="workspace-signout secondary"
                  onClick={signOutToLogin}
                  aria-label="Sign out"
                >
                  <LogOut size={17} />
                  <span>Sign out</span>
                </button>
                <button
                  className="avatar"
                  aria-label="Account settings"
                  onClick={() => go("settings")}
                >
                  {data.user.name.slice(0, 1)}
                </button>
              </div>
            </header>
            <main
              className={
                "workspace-main" +
                (route.page === "project" && data.user.role === "customer"
                  ? " customer-project-main"
                  : "")
              }
              id="workspace-content"
              data-page={route.page}
            >
              {liveNotice && (
                <aside className="live-notice" role="status" aria-live="polite">
                  <Bell size={20} />
                  <div>
                    <strong>{liveNotice.title}</strong>
                    <p>{liveNotice.body}</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        const item = liveNotice;
                        setLiveNotice(null);
                        void run(
                          () => request(`/notifications/${item.id}/read`, {}),
                          "",
                        );
                        go(
                          item.targetPage || "notifications",
                          item.targetId || undefined,
                        );
                      }}
                    >
                      View update
                    </button>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Dismiss notification"
                    onClick={() => setLiveNotice(null)}
                  >
                    <X size={18} />
                  </button>
                </aside>
              )}
              {error && (
                <p role="alert" className="alert error">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="alert">
                  {notice}
                </p>
              )}
              {busy && (
                <p className="busy" role="status">
                  Saving changes…
                </p>
              )}
              {data.user.role === "pro" && hasIntakeResume() && (
                <p className="alert" role="status">
                  Your unfinished project is saved in this tab. To publish it,
                  sign out and sign in with a customer account.
                </p>
              )}
              <Pages />
            </main>
            <footer className="workspace-footer">
              © {new Date().getFullYear()} Aplime <a href="/privacy">Privacy</a>
              <a href="/terms">Service information</a>
            </footer>
          </div>
          <nav className="mobile-bottom-nav" aria-label="Quick navigation">
            <button
              aria-current={
                route.page === "dashboard" ||
                (data.user.role === "pro" &&
                  ["project", "projects", "leads", "quotes"].includes(
                    route.page,
                  )) ||
                (data.user.role === "customer" &&
                  (route.page === "project" ||
                    (route.page === "projects" && !route.id)))
                  ? "page"
                  : undefined
              }
              onClick={() => go("dashboard")}
            >
              <House size={21} />
              <span>Dashboard</span>
            </button>
            {data.user.role === "customer" ? (
              <>
                <button
                  onClick={() => go("projects", "new")}
                  aria-current={
                    route.page === "projects" && !!route.id ? "page" : undefined
                  }
                >
                  <BriefcaseBusiness size={21} />
                  <span>Post project</span>
                </button>
                <button
                  onClick={() => go("schedule")}
                  aria-current={route.page === "schedule" ? "page" : undefined}
                >
                  <CalendarDays size={21} />
                  <span>Schedule</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => go("schedule")}
                  aria-current={route.page === "schedule" ? "page" : undefined}
                >
                  <CalendarDays size={21} />
                  <span>Schedule</span>
                </button>
                <button
                  onClick={() => go("profile")}
                  aria-current={route.page === "profile" ? "page" : undefined}
                >
                  <UserRound size={21} />
                  <span>My business</span>
                </button>
              </>
            )}
            <button
              aria-current={route.page === "messages" ? "page" : undefined}
              onClick={() => go("messages")}
            >
              <MessageCircle size={21} />
              <span>Messages</span>
              {!!data.unreadMessageCount && (
                <span className="notification-count">
                  {data.unreadMessageCount > 99
                    ? "99+"
                    : data.unreadMessageCount}
                </span>
              )}
            </button>
            <button
              aria-label="More navigation options"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
              <span>More</span>
            </button>
          </nav>
          {menu && (
            <div className="drawer-backdrop" onClick={() => setMenu(false)}>
              <aside
                className="drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Workspace navigation"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="icon-button"
                  aria-label="Close navigation"
                  onClick={() => setMenu(false)}
                >
                  <X />
                </button>
                {nav}
              </aside>
            </div>
          )}
        </div>
      </MeetingProvider>
    </Context.Provider>
  );
}
