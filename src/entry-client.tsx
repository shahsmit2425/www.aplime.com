import React, { Suspense, lazy } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { PublicPage } from "./public-page.js";
import { fallbackConfig } from "./shared/config.js";
import "./styles.css";
import "./design-system.css";
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
if (config.sentryDsn) {
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
const root = document.getElementById("root")!;
const native = Capacitor.isNativePlatform();
const privatePage =
  native ||
  location.pathname.startsWith("/app") ||
  location.hash.startsWith("#/");
if (privatePage) {
  createRoot(root).render(
    <React.StrictMode>
      <Suspense
        fallback={
          <div className="loading" role="status">
            Opening your workspace…
          </div>
        }
      >
        <Workspace />
      </Suspense>
    </React.StrictMode>,
  );
} else if (root.hasChildNodes() && window.__PAGE__) {
  hydrateRoot(root, <PublicPage {...window.__PAGE__} />);
} else createRoot(root).render(<PublicPage path={location.pathname} />);
