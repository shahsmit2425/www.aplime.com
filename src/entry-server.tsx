import {
  localServicePage,
  newJerseyBusinesses,
  publicListingProfiles,
} from "./shared/new-jersey.js";
import { renderToString } from "react-dom/server";
import { PublicPage } from "./public-page.js";
import { categories, type Profile } from "./shared/domain.js";
import type { PublicConfig } from "./shared/config.js";
import { informationalPages, serviceSeoContent } from "./shared/seo-content.js";

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function breadcrumbSchema(
  siteUrl: string,
  items: { name: string; path: string }[],
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl + item.path,
    })),
  };
}

export function renderPage(
  path: string,
  config: PublicConfig,
  profile?: Profile,
  profiles: Profile[] = [],
) {
  profiles = publicListingProfiles(profiles);
  const category = categories.find(
    (item) => path === "/services/" + item.toLowerCase(),
  );
  const information =
    informationalPages[path as keyof typeof informationalPages];
  const servicesIndex = path === "/services";
  const coverage = path === "/new-jersey";
  const local = localServicePage(path, profiles);
  const privatePage = path.startsWith("/app");
  const legalPage = ["/privacy", "/terms"].includes(path);
  const valid =
    privatePage ||
    path === "/" ||
    servicesIndex ||
    coverage ||
    !!local ||
    !!category ||
    !!information ||
    !!profile ||
    legalPage;
  const homeDescription =
    "Find New Jersey home-service professionals for cleaning, repairs and improvements. Compare business profiles and estimates, chat, and organize your project with Aplime.";
  const title = profile
    ? `${profile.business} | ${profile.category}${profile.town || profile.details?.city ? ` in ${profile.town || profile.details?.city}, ${profile.region || profile.details?.state || ""}` : ""} | Aplime`
    : local
      ? `${local.category} Services in ${local.town}, NJ | Aplime`
      : coverage
        ? "Home Services in New Jersey | Local Businesses | Aplime"
        : category
          ? `${serviceSeoContent[category].title} | Aplime`
          : information
            ? `${information.title} | Aplime`
            : servicesIndex
              ? "New Jersey Home Services Directory | Aplime"
              : privatePage
                ? "Your workspace | Aplime"
                : !valid
                  ? "Page not found | Aplime"
                  : path === "/"
                    ? "Find Home Service Professionals in New Jersey | Aplime"
                    : path === "/privacy"
                      ? "Privacy Information | Aplime"
                      : "Service Information | Aplime";
  const description = profile
    ? profile.bio.slice(0, 160)
    : local
      ? `Compare ${local.category.toLowerCase()} businesses based in ${local.town}, NJ. Explore real profiles, work photos and reviews, then post a project to confirm coverage and pricing.`
      : coverage
        ? "Explore New Jersey home services and local business areas. Find cleaning, repairs and home improvements, compare professionals, and post your project on Aplime."
        : category
          ? serviceSeoContent[category].description
          : information
            ? information.description
            : servicesIndex
              ? "Explore New Jersey cleaning, handyman, plumbing, electrical, painting and landscaping services. Prepare your project and compare local business profiles on Aplime."
              : homeDescription;
  const siteUrl = config.siteUrl.replace(/\/$/, "");
  const canonical = siteUrl + path;
  const indexable =
    config.environment === "production" && !privatePage && valid && !legalPage;
  const organization = {
    "@type": "Organization",
    "@id": siteUrl + "/#organization",
    name: "Aplime",
    url: siteUrl + "/",
    logo: siteUrl + "/favicon.svg",
    ...(config.supportEmail
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            email: config.supportEmail,
            contactType: "customer support",
          },
        }
      : {}),
  };
  const graph: Record<string, unknown>[] = [organization];
  if (profile) {
    graph.push({
      "@type": "ProfessionalService",
      "@id": canonical + "#business",
      name: profile.business,
      description: profile.bio,
      url: canonical,
      image: profile.images?.map((image) => image.url),
      priceRange: `Starting at $${profile.rate} per hour`,
      telephone: profile.details?.phone,
      email: profile.details?.email,
      areaServed: [profile.zip, profile.details?.serviceAreas].filter(Boolean),
      address: profile.details
        ? {
            "@type": "PostalAddress",
            addressLocality: profile.town || profile.details.city,
            addressRegion: profile.region || profile.details.state,
            postalCode: profile.zip,
            addressCountry: "US",
          }
        : undefined,
      ...(profile.reviewCount > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: profile.rating,
              reviewCount: profile.reviewCount,
            },
          }
        : {}),
    });
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
        { name: profile.business, path },
      ]),
    );
  } else if (local || coverage) {
    const listings = local ? local.profiles : newJerseyBusinesses(profiles);
    graph.push({
      "@type": "CollectionPage",
      "@id": canonical + "#page",
      name: title,
      description,
      url: canonical,
      about: local
        ? {
            "@type": "City",
            name: local.town,
            containedInPlace: { "@type": "State", name: "New Jersey" },
          }
        : { "@type": "State", name: "New Jersey" },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: listings.map((p, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: p.business,
          url: siteUrl + "/professionals/" + encodeURIComponent(p.id),
        })),
      },
    });
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: "New Jersey", path: "/new-jersey" },
        ...(local
          ? [{ name: local.category + " in " + local.town, path }]
          : []),
      ]),
    );
  } else if (category) {
    graph.push({
      "@type": "Service",
      "@id": canonical + "#service",
      name: serviceSeoContent[category].title,
      serviceType: category + " services",
      description,
      url: canonical,
      areaServed: {
        "@type": "State",
        name: "New Jersey",
        containedInPlace: { "@type": "Country", name: "United States" },
      },
      broker: { "@id": organization["@id"] },
    });
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
        { name: category, path },
      ]),
    );
  } else if (servicesIndex) {
    graph.push({
      "@type": "CollectionPage",
      "@id": canonical + "#page",
      name: "Aplime home services directory",
      description,
      url: canonical,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: categories.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item,
          url: siteUrl + "/services/" + item.toLowerCase(),
        })),
      },
    });
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: "Services", path },
      ]),
    );
  } else if (information) {
    graph.push({
      "@type": "WebPage",
      "@id": canonical + "#page",
      name: information.title,
      description,
      url: canonical,
      isPartOf: { "@id": siteUrl + "/#website" },
    });
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: information.title, path },
      ]),
    );
  } else if (path === "/") {
    graph.push({
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      name: "Aplime",
      url: siteUrl + "/",
      description,
      publisher: { "@id": organization["@id"] },
      inLanguage: "en-US",
    });
  }
  const schema = { "@context": "https://schema.org", "@graph": graph };
  const serialize = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");
  const robots = indexable
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";
  const socialImage = siteUrl + "/home.jpg";
  return {
    status: valid ? 200 : 404,
    html: privatePage
      ? ""
      : renderToString(
          <PublicPage path={path} profile={profile} profiles={profiles} />,
        ),
    head:
      "<title>" +
      escapeHtml(title) +
      '</title><meta name="description" content="' +
      escapeHtml(description) +
      '"/><meta name="robots" content="' +
      robots +
      '"/><link rel="canonical" href="' +
      escapeHtml(canonical) +
      '"/><meta property="og:site_name" content="Aplime"/><meta property="og:locale" content="en_US"/><meta property="og:title" content="' +
      escapeHtml(title) +
      '"/><meta property="og:description" content="' +
      escapeHtml(description) +
      '"/><meta property="og:url" content="' +
      escapeHtml(canonical) +
      '"/><meta property="og:type" content="website"/><meta property="og:image" content="' +
      escapeHtml(socialImage) +
      '"/><meta property="og:image:width" content="1400"/><meta property="og:image:height" content="933"/><meta property="og:image:alt" content="A bright, welcoming home interior"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="' +
      escapeHtml(title) +
      '"/><meta name="twitter:description" content="' +
      escapeHtml(description) +
      '"/><meta name="twitter:image" content="' +
      escapeHtml(socialImage) +
      '"/><script type="application/ld+json">' +
      serialize(schema) +
      "</script>",
    bootstrap:
      "<script>window.__CONFIG__=" +
      serialize(config) +
      ";window.__PAGE__=" +
      serialize({ path, profile, profiles }) +
      ";</script>",
  };
}
