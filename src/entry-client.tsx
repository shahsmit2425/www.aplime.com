import { LanguageProvider } from "./shared/language.js";
import React, { Suspense, lazy } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { PublicPage } from "./public-page.js";
import { fallbackConfig } from "./shared/config.js";
import "./styles.css";
import "./design-system.css";
import "./mobile-workspace.css";
import "./professional-listings.css";
// Retire the legacy preview's browser-only fictional data.
try {
  localStorage.removeItem("servicetones-preview-v1");
} catch {
  /* Storage can be disabled. */
}
const Workspace = lazy(() => import("./client/workspace.js"));
if (!window.__CONFIG__) {
  try {
    const r = await fetch("/api/config");
    if (r.ok) window.__CONFIG__ = await r.json();
  } catch {}
}
const config = window.__CONFIG__ || fallbackConfig;
const root = document.getElementById("root")!;
const native = Capacitor.isNativePlatform();
const privatePage =
  native ||
  location.pathname.startsWith("/app") ||
  location.hash.startsWith("#/");
class RecoveryBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="loading" role="alert">
        <h1>This screen couldn’t open</h1>
        <p>Reload Aplime to try again.</p>
        <button onClick={() => location.reload()}>Reload Aplime</button>
      </main>
    );
  }
}

if (privatePage) {
  createRoot(root).render(
    <React.StrictMode>
      <RecoveryBoundary>
        <LanguageProvider>
          <Suspense
            fallback={
              <div className="loading" role="status">
                Opening your workspace…
              </div>
            }
          >
            <Workspace />
          </Suspense>
        </LanguageProvider>
      </RecoveryBoundary>
    </React.StrictMode>,
  );
} else if (root.hasChildNodes() && window.__PAGE__) {
  hydrateRoot(
    root,
    <RecoveryBoundary>
      <LanguageProvider>
        <PublicPage {...window.__PAGE__} supportEmail={config.supportEmail} />
      </LanguageProvider>
    </RecoveryBoundary>,
  );
} else
  createRoot(root).render(
    <RecoveryBoundary>
      <LanguageProvider>
        <PublicPage
          path={location.pathname}
          supportEmail={config.supportEmail}
        />
      </LanguageProvider>
    </RecoveryBoundary>,
  );

async function startMonitoring() {
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      return event;
    },
  });
}

if (config.sentryDsn)
  setTimeout(() => {
    void startMonitoring().catch(() =>
      console.warn("Browser monitoring unavailable."),
    );
  }, 0);
