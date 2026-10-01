import { renderToString } from "react-dom/server";
import { PublicPage } from "./public-page.js";
import { categories, type Profile } from "./shared/domain.js";
import type { PublicConfig } from "./shared/config.js";
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function renderPage(
  path: string,
  config: PublicConfig,
  profile?: Profile,
) {
  const category = categories.find(
    (c) => path === "/services/" + c.toLowerCase(),
  );
  const privatePage = path.startsWith("/app");
  const valid =
    privatePage ||
    path === "/" ||
    !!category ||
    !!profile ||
    ["/privacy", "/terms"].includes(path);
  const title = profile
    ? profile.business + " | " + profile.category + " | Aplime"
    : category
      ? category + " services | Aplime"
      : privatePage
        ? "Your workspace | Aplime"
        : !valid
          ? "Page not found | Aplime"
          : "Aplime | Home services, connected";
  const description = profile
    ? profile.bio.slice(0, 160)
    : "Find home service professionals, compare estimates, and manage your project with messages, calls, and scheduling.";
  const canonical = config.siteUrl + path;
  const indexable =
    config.environment === "production" &&
    !privatePage &&
    valid &&
    !["/privacy", "/terms"].includes(path);
  const schema = {
    "@context": "https://schema.org",
    "@type": profile ? "ProfessionalService" : "Organization",
    name: profile?.business || "Aplime",
    url: canonical,
    ...(profile
      ? { description: profile.bio, areaServed: profile.zip }
      : { logo: config.siteUrl + "/favicon.svg" }),
  };
  const serialize = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");
  return {
    status: valid ? 200 : 404,
    html: privatePage
      ? ""
      : renderToString(<PublicPage path={path} profile={profile} />),
    head:
      "<title>" +
      escapeHtml(title) +
      '</title><meta name="description" content="' +
      escapeHtml(description) +
      '"/><meta name="robots" content="' +
      (indexable ? "index,follow" : "noindex,nofollow") +
      '"/><link rel="canonical" href="' +
      escapeHtml(canonical) +
      '"/><meta property="og:title" content="' +
      escapeHtml(title) +
      '"/><meta property="og:description" content="' +
      escapeHtml(description) +
      '"/><meta property="og:url" content="' +
      escapeHtml(canonical) +
      '"/><meta property="og:type" content="website"/><meta property="og:image" content="' +
      escapeHtml(config.siteUrl + "/home.jpg") +
      '"/><script type="application/ld+json">' +
      serialize(schema) +
      "</script>",
    bootstrap:
      "<script>window.__CONFIG__=" +
      serialize(config) +
      ";window.__PAGE__=" +
      serialize({ path, profile }) +
      ";</script>",
  };
}
