import React, { useEffect, useState } from "react";
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
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
} from "firebase/auth";
import type { PublicConfig } from "../../src/shared/config.js";
import type { Workspace } from "../../src/shared/domain.js";
import "./styles.css";

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
  if (!r.ok) throw new Error(result.error || "Request failed");
  return result;
}
function Admin() {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [data, setData] = useState<Workspace | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null),
    [enroll, setEnroll] = useState(false),
    [secret, setSecret] = useState<TotpSecret | null>(null),
    [page, setPage] = useState("Overview");
  useEffect(() => {
    void (async () => {
      if (!apiUrl || (import.meta.env.PROD && !apiUrl.startsWith("https://")))
        throw new Error("Administrator API URL is not configured.");
      const r = await fetch(apiUrl + "/api/config");
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
    })().catch((e) => setError(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setData(await request<Workspace>("/workspace"));
  }
  async function exit() {
    setData(null);
    setResolver(null);
    setSecret(null);
    setEnroll(false);
    if (auth) await signOut(auth);
  }
  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => {
      void load().catch((e) => {
        setData(null);
        setError(e.message);
      });
    }, 60000);
    return () => clearInterval(id);
  }, [!!data]);
  async function signedIn() {
    const u = auth.currentUser!;
    const t = await u.getIdTokenResult(true);
    if (t.claims.admin !== true || !u.emailVerified) {
      await exit();
      throw new Error("This account is not authorized for administration.");
    }
    if (!multiFactor(u).enrolledFactors.some((f) => f.factorId === "totp")) {
      setEnroll(true);
      return;
    }
    await load();
  }
  async function login(form: FormData) {
    try {
      await signInWithEmailAndPassword(
        auth,
        String(form.get("email")),
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
        {(data || enroll || resolver) && (
          <button onClick={() => void run(exit)}>Sign out</button>
        )}
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!data ? (
          <section className="login">
            <h1>Administrator access</h1>
            <p>
              Access is restricted to approved administrators. An authenticator
              code is required.
            </p>
            {!ready ? (
              <p>Configuration must be available before sign-in.</p>
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
                <h2>Set up your authenticator</h2>
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
                    <p>
                      Add this key to your authenticator app for Aplime:
                    </p>
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
              </form>
            )}
          </section>
        ) : (
          <>
            <nav aria-label="Administration">
              {[
                "Overview",
                "Professionals",
                "Projects",
                "Payments",
                "Support",
              ].map((p) => (
                <button
                  aria-current={page === p ? "page" : undefined}
                  key={p}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button disabled={busy} onClick={() => void run(load)}>
                Refresh
              </button>
            </nav>
            <h1>{page}</h1>
            {page === "Overview" && (
              <div className="metrics">
                {[
                  ["Projects", data.projects.length],
                  ["Professionals", data.profiles.length],
                  [
                    "Open cases",
                    data.tickets.filter((t) => t.status === "open").length,
                  ],
                ].map(([k, v]) => (
                  <article key={k}>
                    <h2>{k}</h2>
                    <strong>{v}</strong>
                  </article>
                ))}
                <p>
                  These counts reflect the current loaded records. Private
                  messages and attachments are excluded.
                </p>
              </div>
            )}
            {page === "Professionals" && (
              <div className="records">
                {data.profiles.map((p) => (
                  <article key={p.id}>
                    <h2>{p.business}</h2>
                    <p>
                      {p.name} · {p.category} ·{" "}
                      {p.verified
                        ? "Identity verified"
                        : "Verification pending"}{" "}
                      · {p.suspended ? "Suspended" : "Active"}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request(
                            "/profiles/" + encodeURIComponent(p.id),
                            { suspended: !p.suspended },
                          );
                          await load();
                        })
                      }
                    >
                      {p.suspended ? "Restore access" : "Suspend access"}
                    </button>
                  </article>
                ))}
                {!data.profiles.length && <p>No professional profiles.</p>}
              </div>
            )}
            {page === "Projects" && (
              <div className="records">
                {data.projects.map((p) => (
                  <article key={p.id}>
                    <h2>{p.title}</h2>
                    <p>
                      {p.customerName} · {p.proName || "Unassigned"} ·{" "}
                      {p.status}
                    </p>
                    <p>{p.description}</p>
                    <small>{p.id}</small>
                  </article>
                ))}
                {!data.projects.length && <p>No projects.</p>}
              </div>
            )}
            {page === "Payments" && (
              <div className="records">
                {data.payments.map((p) => (
                  <article key={p.id}>
                    <h2>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(p.amount / 100)}
                    </h2>
                    <p>
                      {p.status} · Project {p.projectId}
                    </p>
                  </article>
                ))}
                {!data.payments.length && <p>No transactions.</p>}
              </div>
            )}
            {page === "Support" && (
              <div className="records">
                {data.tickets.map((t) => (
                  <article key={t.id}>
                    <h2>{t.subject}</h2>
                    <p>{t.body}</p>
                    <p>Status: {t.status}</p>
                    {t.resolution && <p>{t.resolution}</p>}
                    {t.status === "open" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            await request("/tickets/" + t.id, {
                              resolution: String(f.get("resolution")),
                              refund: f.get("refund") === "on",
                            });
                            await load();
                          });
                        }}
                      >
                        <label>
                          Resolution
                          <textarea
                            name="resolution"
                            minLength={10}
                            maxLength={3000}
                            required
                          />
                        </label>
                        <label className="check">
                          <input type="checkbox" name="refund" />
                          Issue a full refund for the associated payment
                        </label>
                        <button disabled={busy}>Resolve case</button>
                      </form>
                    )}
                  </article>
                ))}
                {!data.tickets.length && <p>No support cases.</p>}
              </div>
            )}
          </>
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
