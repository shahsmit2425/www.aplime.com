import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import helmet from "helmet";
import { categories } from "../../src/shared/domain.js";
import type { Profile } from "../../src/shared/domain.js";
import { fallbackConfig, type PublicConfig } from "../../src/shared/config.js";
import { seoStaticPaths } from "../../src/shared/seo-content.js";
const env = {
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV || "development",
  SITE_URL: process.env.SITE_URL || "http://127.0.0.1:5173",
};
const apiUrl = (process.env.API_URL || "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const siteUrl = new URL(env.SITE_URL);
if (
  env.NODE_ENV === "production" &&
  (!apiUrl.startsWith("https://") || !env.SITE_URL.startsWith("https://"))
)
  throw new Error("API_URL and SITE_URL must be HTTPS");
async function api<T>(path: string): Promise<T> {
  const r = await fetch(apiUrl + "/api" + path, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("API unavailable");
  return r.json() as Promise<T>;
}
async function publicProfiles(id?: string) {
  return api<Profile[]>(
    id ? "/professionals/" + encodeURIComponent(id) : "/professionals",
  );
}
let cachedConfiguration: { value: PublicConfig; expiresAt: number } | undefined;
async function configuration() {
  if (cachedConfiguration && cachedConfiguration.expiresAt > Date.now())
    return cachedConfiguration.value;
  let c: PublicConfig;
  try {
    c = await api<PublicConfig>("/config");
  } catch {
    console.warn(
      "API configuration is unavailable; serving public pages with authentication disabled.",
    );
    const fallback = {
      ...fallbackConfig,
      environment: env.APP_ENV as PublicConfig["environment"],
      siteUrl: env.SITE_URL,
      apiUrl,
      release: process.env.RENDER_GIT_COMMIT || "local",
    };
    cachedConfiguration = { value: fallback, expiresAt: Date.now() + 10000 };
    return fallback;
  }
  if (c.environment !== env.APP_ENV)
    throw new Error("API environment mismatch");
  const value = {
    ...c,
    siteUrl: env.SITE_URL,
    apiUrl,
    release: process.env.RENDER_GIT_COMMIT || "local",
  };
  cachedConfiguration = { value, expiresAt: Date.now() + 60000 };
  return value;
}
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        connectSrc: [
          "'self'",
          apiUrl,
          "https://*.googleapis.com",
          "https://*.firebaseapp.com",
          "https://*.sentry.io",
          "https://*.ingest.us.sentry.io",
          "https://*.ingest.de.sentry.io",
          "https://*.r2.cloudflarestorage.com",
          ...(env.NODE_ENV === "production"
            ? []
            : ["ws://127.0.0.1:*", "ws://localhost:*"]),
        ],
        frameSrc: [
          "https://*.firebaseapp.com",
          "https://*.google.com",
          "https://appleid.apple.com",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:", apiUrl],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
app.get("/health", (_q, r) =>
  r.json({
    ok: true,
    environment: env.APP_ENV,
    release: process.env.RENDER_GIT_COMMIT || "local",
  }),
);
app.use((req, res, next) => {
  if (
    env.APP_ENV === "production" &&
    req.method === "GET" &&
    req.get("host") !== siteUrl.host
  )
    return res.redirect(308, siteUrl.origin + req.originalUrl);
  if (req.path.length > 1 && req.path.endsWith("/")) {
    const suffix = req.originalUrl.slice(req.path.length);
    return res.redirect(308, req.path.slice(0, -1) + suffix);
  }
  next();
});
app.use("/api", (_q, r) =>
  r.status(404).json({ error: "Use the API domain." }),
);
app.use((req, res, next) => {
  if (env.APP_ENV !== "production" || req.path.startsWith("/app"))
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.get("/robots.txt", (_q, r) =>
  r
    .set("Cache-Control", "public, max-age=3600")
    .type("text/plain")
    .send(
      env.APP_ENV === "production"
        ? "User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\nSitemap: " +
            env.SITE_URL +
            "/sitemap.xml\n"
        : "User-agent: *\nDisallow: /\n",
    ),
);
app.get("/sitemap.xml", async (_q, r) => {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  let professionalPaths: string[] = [];
  if (env.APP_ENV === "production")
    try {
      professionalPaths = (await publicProfiles()).map(
        (profile) => "/professionals/" + encodeURIComponent(profile.id),
      );
    } catch {
      console.error("Sitemap profile lookup failed; serving static URLs only");
    }
  const paths =
    env.APP_ENV === "production"
      ? [
          "/",
          ...seoStaticPaths,
          ...categories.map((c) => "/services/" + c.toLowerCase()),
          ...professionalPaths,
        ]
      : [];
  r.set("Cache-Control", "public, max-age=900, stale-while-revalidate=3600")
    .type("application/xml")
    .send(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        paths
          .map((p) => "<url><loc>" + esc(env.SITE_URL + p) + "</loc></url>")
          .join("") +
        "</urlset>",
    );
});
let vite: import("vite").ViteDevServer | undefined;
if (env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
} else app.use(express.static("dist/client", { index: false, maxAge: "1h" }));
app.use(async (req, res, next) => {
  if (req.method !== "GET") return next();
  try {
    const pathName = req.path;
    const profileId = pathName.startsWith("/professionals/")
      ? decodeURIComponent(pathName.slice("/professionals/".length))
      : undefined;
    const profile = profileId
      ? (await publicProfiles(profileId))[0]
      : undefined;
    const mod = vite
      ? await vite.ssrLoadModule("/src/entry-server.tsx")
      : await import(
          pathToFileURL(path.resolve("dist/server/entry-server.js")).href
        );
    const page = mod.renderPage(pathName, await configuration(), profile);
    let template = await readFile(
      vite ? "index.html" : "dist/client/index.html",
      "utf8",
    );
    if (vite)
      template = await vite.transformIndexHtml(req.originalUrl, template);
    res.setHeader("Content-Language", "en-US");
    res.setHeader(
      "Cache-Control",
      env.APP_ENV === "production" && !pathName.startsWith("/app")
        ? pathName.startsWith("/professionals/")
          ? "public, max-age=0, must-revalidate"
          : "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
        : "no-store",
    );
    res
      .status(page.status)
      .type("html")
      .send(
        template
          .replace("<!--head-->", page.head)
          .replace("<!--app-->", page.html)
          .replace("<!--bootstrap-->", page.bootstrap),
      );
  } catch (e) {
    next(e);
  }
});

app.use(
  (
    error: unknown,
    _q: express.Request,
    r: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Website request failed");
    r.status(503)
      .type("html")
      .send(
        "<h1>Aplime is temporarily unavailable</h1><p>Please try again shortly.</p>",
      );
  },
);
app.listen(Number(process.env.PORT || 5173), "0.0.0.0", () =>
  console.log("Customer website: " + env.SITE_URL),
);
