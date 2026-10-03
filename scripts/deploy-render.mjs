import fs from "node:fs";
const { RENDER_API_KEY, GITHUB_SHA, GITHUB_REF_NAME } = process.env;
const selected = ["api", "worker", "web", "admin"].filter(
  (k) => process.env["DEPLOY_" + k.toUpperCase()] === "true",
);
if (!selected.length) {
  console.log("No deployable code changed.");
  process.exit(0);
}
for (const key of ["RENDER_API_KEY", "GITHUB_SHA", "GITHUB_REF_NAME"])
  if (!process.env[key])
    throw new Error("Missing GitHub configuration: " + key);
const mapping = JSON.parse(fs.readFileSync("config/environments.json", "utf8"));
if (!mapping[GITHUB_REF_NAME]) throw new Error("Unmapped deployment branch.");
const base = "https://api.render.com/v1";
async function api(path, body) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + RENDER_API_KEY,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("Render API request failed: " + r.status);
  return r.json();
}
async function deploy(id) {
  const service = await api("/services/" + id);
  if (service.branch !== GITHUB_REF_NAME)
    throw new Error("Render service branch does not match the pushed branch.");
  const deployed = await api("/services/" + id + "/deploys", {
    commitId: GITHUB_SHA,
    clearCache: "do_not_clear",
  });
  console.log("Waiting for Render deployment " + deployed.id);
  for (let attempt = 0; attempt < 120; attempt++) {
    const d = await api("/services/" + id + "/deploys/" + deployed.id);
    if (d.status === "live") {
      console.log("Render deployment is live.");
      return;
    }
    if (
      ["build_failed", "update_failed", "canceled", "deactivated"].includes(
        d.status,
      )
    )
      throw new Error("Render deployment failed: " + d.status);
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error("Render deployment timed out.");
}

for (const target of selected) {
  const key = "RENDER_" + target.toUpperCase() + "_SERVICE_ID";
  if (!process.env[key])
    throw new Error("Missing GitHub configuration: " + key);
  await deploy(process.env[key]);
  if (target === "worker") continue;
  const urlKey =
    target === "api"
      ? "API_URL"
      : target === "admin"
        ? "ADMIN_URL"
        : "SITE_URL";
  const url = process.env[urlKey];
  if (!url?.startsWith("https://")) throw new Error("Set HTTPS " + urlKey);
  const endpoint =
    target === "api"
      ? "/api/health"
      : target === "admin"
        ? "/release.json"
        : "/health";
  const response = await fetch(url.replace(/\/$/, "") + endpoint, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(target + " health check failed");
  const health = await response.json();
  if (
    health.release !== GITHUB_SHA ||
    health.environment !== mapping[GITHUB_REF_NAME].environment
  )
    throw new Error(target + " release/environment mismatch");
  if (target === "web") {
    const site = url.replace(/\/$/, "");
    const [homeResponse, robotsResponse, sitemapResponse] = await Promise.all([
      fetch(site + "/", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }),
      fetch(site + "/robots.txt", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }),
      fetch(site + "/sitemap.xml", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }),
    ]);
    if (!homeResponse.ok || !robotsResponse.ok || !sitemapResponse.ok)
      throw new Error("Web SEO endpoint verification failed");
    const [home, robots, sitemap] = await Promise.all([
      homeResponse.text(),
      robotsResponse.text(),
      sitemapResponse.text(),
    ]);
    if (
      !home.includes(`<link rel="canonical" href="${site}/"`) ||
      !home.includes('type="application/ld+json"')
    )
      throw new Error("Web canonical or structured data is missing");
    const production = mapping[GITHUB_REF_NAME].environment === "production";
    if (production) {
      if (
        !robots.includes(`Sitemap: ${site}/sitemap.xml`) ||
        !sitemap.includes(`${site}/services/plumbing`)
      )
        throw new Error("Production robots or sitemap content is invalid");
    } else if (
      !robots.includes("Disallow: /") ||
      !homeResponse.headers.get("x-robots-tag")?.includes("noindex")
    )
      throw new Error("Non-production website is not protected from indexing");
  }
}
