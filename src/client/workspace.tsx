import { watchNotifications } from "./live-notifications.js";
import type { Notice } from "../shared/domain.js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
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
    ["dashboard", "Overview"],
    ["discover", "Find professionals"],
    ["projects", "My projects"],
    ["quotes", "Estimates"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["saved", "Saved pros"],
    ["reviews", "My reviews"],
  ],
  pro: [
    ["dashboard", "Overview"],
    ["leads", "Find projects"],
    ["projects", "My jobs"],
    ["quotes", "My estimates"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["subscription", "Subscription"],
    ["profile", "Business profile"],
    ["verification", "Identity verification"],
    ["availability", "Calendar & preferences"],
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
    [menu, setMenu] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const loadSequence = useRef(0);
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
      if (next !== current) replaceRoute(next);
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
    const refresh = () => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.user.id]);
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
  if (!data)
    return (
      <div className="auth-page">
        <Brand />
        <section className="auth-card">
          <p className="eyebrow">WELCOME TO APLIME</p>
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
                <RoleChoice value={signupRole} onChange={chooseSignupRole} />
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
                  <RoleChoice value={signupRole} onChange={chooseSignupRole} />
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
    ["notifications", "Notifications"],
    ["settings", "Settings"],
    ["help", "Help & safety"],
  ];
  const nav = (
    <>
      <Brand />
      <p className="workspace-label">
        {data.user.role === "pro" ? "YOUR BUSINESS" : "YOUR HOME, ORGANIZED"}
      </p>
      <nav aria-label="Workspace navigation">
        {links.map(([p, label]) => {
          const Icon = navIcons[p];
          return (
            <button
              key={p}
              className={route.page === p ? "nav-link active" : "nav-link"}
              onClick={() => go(p)}
            >
              <Icon size={19} />
              {label}
            </button>
          );
        })}
      </nav>
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
      <div className="workspace">
        <aside className="sidebar">{nav}</aside>
        <div className="workspace-body">
          {config.environment !== "production" && (
            <div className="environment-bar">
              {config.environment === "stagging" ? "Staging" : "Development"}{" "}
              environment
            </div>
          )}
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>
              {data.user.role === "pro" ? "Provider" : "Customer"} workspace{" "}
              <b>
                /{" "}
                {links.find((l) => l[0] === route.page)?.[1] ||
                  (route.page === "pro"
                    ? "Professional profile"
                    : "Project details")}
              </b>
            </span>
            <div className="actions">
              <button
                className="icon-button"
                aria-label={`Notifications, ${data.unreadCount || 0} unread`}
                onClick={() => go("notifications")}
              >
                <Bell size={20} />
                {data.unreadCount > 0 && (
                  <span className="notification-count">
                    {data.unreadCount > 99 ? "99+" : data.unreadCount}
                  </span>
                )}
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
          <main className="workspace-main">
            {route.page === "notifications" && (
              <p className="notification-connection" role="status">
                {liveConnected
                  ? "Live updates connected"
                  : "Reconnecting live updates — checking periodically"}
              </p>
            )}
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
            <Pages />
          </main>
          <footer className="workspace-footer">
            © {new Date().getFullYear()} Aplime <a href="/privacy">Privacy</a>
            <a href="/terms">Service information</a>
          </footer>
        </div>
        {menu && (
          <div className="drawer-backdrop" onClick={() => setMenu(false)}>
            <aside className="drawer" onClick={(e) => e.stopPropagation()}>
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
    </Context.Provider>
  );
}
