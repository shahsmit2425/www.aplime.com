import {
  createContext,
  useContext,
  useEffect,
  useState,
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
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
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
  reviews: Star,
  profile: UserRound,
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
    ["discover", "Find a pro"],
    ["projects", "My projects"],
    ["quotes", "Estimates"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["saved", "Saved pros"],
    ["payments", "Payments & receipts"],
    ["reviews", "My reviews"],
  ],
  pro: [
    ["dashboard", "Overview"],
    ["leads", "Opportunities"],
    ["projects", "My jobs"],
    ["quotes", "My estimates"],
    ["schedule", "Schedule"],
    ["messages", "Messages"],
    ["earnings", "Earnings"],
    ["profile", "Business profile"],
    ["availability", "Availability"],
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
        className={value === "customer" ? "role-option selected" : "role-option"}
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
    [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [needsAccount, setNeedsAccount] = useState(false),
    [menu, setMenu] = useState(false);
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
    try {
      const result = await request<Data>("/workspace");
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
      setError((e as Error).message);
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
  async function run(fn: () => Promise<unknown>, message = "Saved.") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (firebaseUser?.emailVerified) await load();
      if (message) setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
              <li className={route.page === "register" && !firebaseUser ? "current" : "complete"}>
                <span>1</span> Account
              </li>
              <li className={firebaseUser && !firebaseUser.emailVerified ? "current" : needsAccount ? "complete" : ""}>
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
                . Then refresh your verification status.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await firebaseUser.reload();
                    await firebaseUser.getIdToken(true);
                    setFirebaseUser(auth().currentUser);
                    if (auth().currentUser?.emailVerified) await load();
                  }, "Verification checked.")
                }
              >
                I’ve verified my email
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void run(
                    () => verifyEmail(firebaseUser),
                    "Verification email sent.",
                  )
                }
              >
                Resend email
              </button>
              <button className="text-button" onClick={() => void logout()}>
                Sign out
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
                onClick={() => void logout()}
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
              <button className="text-button" onClick={() => void logout()}>
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
                      if (route.page === "register")
                        await register(email, String(f.get("password")));
                      else await login(email, String(f.get("password")));
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
                    onClick={() => void run(google, "")}
                  >
                    Continue with Google
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void run(apple, "")}
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
          onClick={() => void logout()}
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
                  "Project details"}
              </b>
            </span>
            <div className="actions">
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => go("notifications")}
              >
                <Bell size={20} />
                {data.notices.some((n) => !n.read) && <i />}
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
            © {new Date().getFullYear()} Aplime{" "}
            <a href="/privacy">Privacy</a>
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
