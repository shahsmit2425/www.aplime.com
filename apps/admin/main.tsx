import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut,
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  sendEmailVerification,
  sendPasswordResetEmail,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
} from "firebase/auth";
import type { PublicConfig } from "../../src/shared/config.js";
import type { AdminSession } from "../../src/shared/admin.js";
import { AdminConsole } from "./console.js";
import "./styles.css";
import {
  adminAuthError,
  adminLoginDestination,
  requestAdminPasswordReset,
  type AdminLoginStep,
} from "./auth-flow.js";

const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let auth: ReturnType<typeof getAuth>;
async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(apiUrl + "/api/admin" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await r.json();
  if (!r.ok) {
    if ([401, 403].includes(r.status))
      window.dispatchEvent(
        new CustomEvent("admin-session-ended", {
          detail: result.error || "Please sign in again.",
        }),
      );
    throw new Error(result.error || "Request failed");
  }
  return result;
}
function Admin() {
  const sessionEpoch = useRef(0);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [data, setData] = useState<AdminSession | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null),
    [enroll, setEnroll] = useState(false),
    [secret, setSecret] = useState<TotpSecret | null>(null);
  const [loginStep, setLoginStep] = useState<AdminLoginStep>("sign_in");
  const [loginEmail, setLoginEmail] = useState("");
  const [resendUntil, setResendUntil] = useState(0);
  useEffect(() => {
    void (async () => {
      if (!apiUrl || (import.meta.env.PROD && !apiUrl.startsWith("https://")))
        throw new Error("Administrator API URL is not configured.");
      const r = await fetch(apiUrl + "/api/config", {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("API unavailable");
      const c = (await r.json()) as PublicConfig;
      if (!c.firebase.apiKey)
        throw new Error(
          "Administrator sign-in is not configured. Set up Firebase on the API first.",
        );
      if (c.environment !== import.meta.env.VITE_APP_ENV)
        throw new Error("Administrator environment mismatch.");
      auth = getAuth(initializeApp(c.firebase, "administrator"));
      await setPersistence(auth, inMemoryPersistence);
      setReady(true);
    })().catch((e) =>
      setError(
        e instanceof TypeError || e?.name === "TimeoutError"
          ? "Administrator sign-in could not reach the API. Check API_URL, API availability and whether this admin origin is allowed."
          : e.message,
      ),
    );
  }, []);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(adminAuthError(e));
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    const epoch = sessionEpoch.current;
    const owner = auth.currentUser;
    const result = await request<AdminSession>("/session");
    // A response started before sign-out must never restore a protected screen.
    if (epoch === sessionEpoch.current && owner && auth.currentUser === owner)
      setData(result);
  }
  async function exit() {
    sessionEpoch.current++;
    setData(null);
    setResolver(null);
    setSecret(null);
    setEnroll(false);
    setLoginStep("sign_in");
    setResendUntil(0);
    if (auth) await signOut(auth);
  }
  useEffect(() => {
    const expired = (event: Event) => {
      void exit()
        .then(() => setError((event as CustomEvent<string>).detail))
        .catch(() => setError("Please reload and sign in again."));
    };
    window.addEventListener("admin-session-ended", expired);
    return () => window.removeEventListener("admin-session-ended", expired);
  }, []);
  useEffect(() => {
    if (!data) return;
    const epoch = sessionEpoch.current;
    const id = setInterval(() => {
      void load().catch(async (e) => {
        if (epoch !== sessionEpoch.current) return;
        await exit();
        setError(e.message);
      });
    }, 60000);
    return () => clearInterval(id);
  }, [!!data]);
  useEffect(() => {
    if (!data) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const owner = auth.currentUser;
    const epoch = sessionEpoch.current;
    const connect = async () => {
      controller = new AbortController();
      const currentController = controller;
      const timeout = setTimeout(() => currentController.abort(), 75000);
      try {
        const token = await owner?.getIdToken();
        if (stopped) return;
        const response = await fetch(
          apiUrl + "/api/admin/notifications/stream",
          {
            headers: { Authorization: "Bearer " + token },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body)
          throw new Error("Live updates unavailable");
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const event = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (event.includes("data: changed")) {
              const result = await request<AdminSession>("/session");
              if (
                !stopped &&
                epoch === sessionEpoch.current &&
                auth.currentUser === owner
              )
                setData(result);
            }
          }
        }
      } catch {
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(() => void connect(), 3000);
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [data?.user.id]);
  async function signedIn() {
    const u = auth.currentUser!;
    await u.reload();
    const t = await u.getIdTokenResult(true);
    const destination = adminLoginDestination(
      u.emailVerified,
      t.claims.admin,
      multiFactor(u).enrolledFactors.some((f) => f.factorId === "totp"),
    );
    if (destination === "verify_email" || destination === "approval") {
      setLoginStep(destination);
      setEnroll(false);
      setSecret(null);
      return;
    }
    setLoginStep("sign_in");
    if (destination === "enroll") {
      setEnroll(true);
      return;
    }
    await load();
  }
  useEffect(() => {
    if (!resendUntil) return;
    const timer = setTimeout(
      () => setResendUntil(0),
      Math.max(0, resendUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [resendUntil]);
  async function login(form: FormData) {
    try {
      await signInWithEmailAndPassword(
        auth,
        String(form.get("email")).trim(),
        String(form.get("password")),
      );
      await signedIn();
    } catch (e) {
      if ((e as { code?: string }).code === "auth/multi-factor-auth-required") {
        setResolver(getMultiFactorResolver(auth, e as MultiFactorError));
      } else throw e;
    }
  }
  return (
    <div className="admin-shell">
      <header>
        <strong>
          Aplime <span>Administration</span>
        </strong>
        <small>{import.meta.env.VITE_APP_ENV || "Unconfigured"}</small>
        {(data ||
          enroll ||
          resolver ||
          loginStep === "verify_email" ||
          loginStep === "approval") && (
          <button disabled={busy} onClick={() => void run(exit)}>
            Sign out
          </button>
        )}
      </header>
      <main className={data ? "admin-console-main" : undefined}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!data ? (
          <section className="login">
            <p className="admin-eyebrow">PRIVATE ADMINISTRATION</p>
            <h1>
              {loginStep === "verify_email"
                ? "Verify your email"
                : loginStep === "approval"
                  ? "Owner approval required"
                  : loginStep === "recover"
                    ? "Reset your password"
                    : resolver
                      ? "Confirm it’s you"
                      : enroll
                        ? "Secure your account"
                        : "Administrator sign-in"}
            </h1>
            <p>
              Access is restricted to approved administrators. An authenticator
              code is required.
            </p>
            <ol
              className="admin-auth-steps"
              aria-label="Administrator sign-in steps"
            >
              {[
                "Sign in",
                "Verify email",
                "Owner approval",
                "Authenticator",
              ].map((label, index) => {
                const current =
                  resolver || enroll
                    ? 3
                    : loginStep === "approval"
                      ? 2
                      : loginStep === "verify_email"
                        ? 1
                        : 0;
                return (
                  <li
                    key={label}
                    aria-current={current === index ? "step" : undefined}
                  >
                    <span>{index + 1}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
            {!ready ? (
              <p>Configuration must be available before sign-in.</p>
            ) : loginStep === "verify_email" ? (
              <>
                <p>
                  Confirm ownership of{" "}
                  <strong>{auth.currentUser?.email}</strong>. This verifies your
                  mailbox; it does not grant administrator access.
                </p>
                <div className="admin-auth-actions">
                  <button
                    disabled={busy || resendUntil > Date.now()}
                    onClick={() =>
                      void run(async () => {
                        await sendEmailVerification(auth.currentUser!);
                        setResendUntil(Date.now() + 60000);
                        setNotice(
                          "Verification email sent. Follow the link in your inbox, then check verification here.",
                        );
                      })
                    }
                  >
                    {resendUntil > Date.now()
                      ? "Email sent — wait to resend"
                      : "Send verification email"}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await signedIn();
                        if (auth.currentUser && !auth.currentUser.emailVerified)
                          setNotice(
                            "The email is not verified yet. Open the link in your inbox, then check again.",
                          );
                      })
                    }
                  >
                    I verified my email
                  </button>
                </div>
                <p className="admin-auth-note">
                  After verification, the owner completes approval in the API
                  service Shell. You do not need a customer or professional
                  profile.
                </p>
              </>
            ) : loginStep === "approval" ? (
              <>
                <p>
                  Your email is verified. This account has not been provisioned
                  for administration. No administrator data is available.
                </p>
                <label>
                  Account ID for owner approval
                  <input
                    value={auth.currentUser?.uid || ""}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
                <p className="admin-auth-note">
                  The owner must approve this account ID in the API’s allowlist
                  and run the trusted setup command. Creating a Firebase account
                  or knowing the admin URL cannot grant access.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await exit();
                      setNotice(
                        "Sign in again after the owner finishes approval. Access changes require a fresh sign-in.",
                      );
                    })
                  }
                >
                  Return to sign-in
                </button>
              </>
            ) : loginStep === "recover" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void run(async () => {
                    await requestAdminPasswordReset(() =>
                      sendPasswordResetEmail(
                        auth,
                        String(form.get("email")).trim(),
                      ),
                    );
                    setNotice(
                      "If this email has an account, a password-reset email will arrive shortly. Resetting a password does not grant administrator access.",
                    );
                  });
                }}
              >
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </label>
                <div className="admin-auth-actions">
                  <button disabled={busy}>Send reset email</button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setLoginStep("sign_in");
                      setError("");
                      setNotice("");
                    }}
                  >
                    Back to sign-in
                  </button>
                </div>
              </form>
            ) : resolver ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const hint = resolver.hints.find(
                      (h) => h.factorId === "totp",
                    );
                    if (!hint)
                      throw new Error(
                        "A TOTP authenticator must be enrolled by this administrator.",
                      );
                    await resolver.resolveSignIn(
                      TotpMultiFactorGenerator.assertionForSignIn(
                        hint.uid,
                        String(f.get("code")),
                      ),
                    );
                    setResolver(null);
                    await signedIn();
                  });
                }}
              >
                <label>
                  Authenticator code
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button disabled={busy}>Verify and sign in</button>
              </form>
            ) : enroll ? (
              <>
                <h2>Add your authenticator</h2>
                <p>
                  Enrollment does not grant administrator access. Your approved
                  account must also be enabled on the server.
                </p>
                {!secret ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        setSecret(
                          await TotpMultiFactorGenerator.generateSecret(
                            await multiFactor(auth.currentUser!).getSession(),
                          ),
                        ),
                      )
                    }
                  >
                    Generate setup key
                  </button>
                ) : (
                  <>
                    <p>Add this key to your authenticator app for Aplime:</p>
                    <code className="secret">{secret.secretKey}</code>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          await multiFactor(auth.currentUser!).enroll(
                            TotpMultiFactorGenerator.assertionForEnrollment(
                              secret,
                              String(f.get("code")),
                            ),
                            "Aplime admin",
                          );
                          await exit();
                          setNotice(
                            "Authenticator enrolled. Sign in again using your new code.",
                          );
                        });
                      }}
                    >
                      <label>
                        Authenticator code
                        <input
                          name="code"
                          pattern="[0-9]{6}"
                          inputMode="numeric"
                          required
                        />
                      </label>
                      <button disabled={busy}>Complete enrollment</button>
                    </form>
                  </>
                )}
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => login(new FormData(e.currentTarget)));
                }}
              >
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button disabled={busy}>Sign in</button>
                <button
                  type="button"
                  className="admin-text-button"
                  disabled={busy}
                  onClick={() => {
                    setLoginStep("recover");
                    setError("");
                    setNotice("");
                  }}
                >
                  Forgot password?
                </button>
              </form>
            )}
            <p className="admin-auth-note">
              No public administrator registration. Access is checked by the API
              on every request. Never share your password or authenticator setup
              key.
            </p>
          </section>
        ) : (
          <AdminConsole
            session={data}
            request={request}
            run={run}
            busy={busy}
            refresh={load}
          />
        )}
      </main>
      <footer>
        Restricted administration · Sessions require sign-in again after one
        hour.
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Admin />);
