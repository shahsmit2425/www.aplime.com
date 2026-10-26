import {
  findGuide,
  homeGuides,
  guidePath,
  guideDate,
} from "./shared/articles.js";
import { serviceSlug } from "./shared/service-questionnaires.js";
import { renderToString } from "react-dom/server";
import { PublicPage } from "./public-page.js";
import { categories, type Profile } from "./shared/domain.js";
import type { PublicConfig } from "./shared/config.js";
import {
  generalFaqs,
  informationalPages,
  serviceSeoContent,
} from "./shared/seo-content.js";

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

const withBrand = (title: string) =>
  title.includes("Aplime") ? title : title + " | Aplime";

export function renderPage(
  path: string,
  config: PublicConfig,
  profile?: Profile,
) {
  const guide = findGuide(path);
  const guidesIndex = path === "/blog";
  const category = categories.find(
    (item) => path === "/services/" + serviceSlug(item),
  );
  const information =
    informationalPages[path as keyof typeof informationalPages];
  const servicesIndex = path === "/services";
  const privatePage = path.startsWith("/app");
  const legalPage = ["/privacy", "/terms"].includes(path);
  const valid =
    !!guide ||
    guidesIndex ||
    privatePage ||
    path === "/" ||
    servicesIndex ||
    !!category ||
    !!information ||
    !!profile ||
    legalPage;
  const homeDescription =
    "Find home-service professionals, compare itemized estimates, and manage project messages, calls, scheduling, and updates with Aplime.";
  const title = guide
    ? withBrand(guide.title)
    : guidesIndex
      ? "New Jersey Homeowner Guides & Project Advice | Aplime"
      : profile
        ? `${profile.business} | ${profile.category}${profile.details?.city ? ` in ${profile.details.city}, ${profile.details.state}` : ""} | Aplime`
        : category
          ? withBrand(serviceSeoContent[category].title)
          : information
            ? withBrand(information.title)
            : servicesIndex
              ? "Home Services Directory | Aplime"
              : privatePage
                ? "Your workspace | Aplime"
                : !valid
                  ? "Page not found | Aplime"
                  : path === "/"
                    ? "Home Services Made Simple | Aplime"
                    : path === "/privacy"
                      ? "Privacy Information | Aplime"
                      : "Service Information | Aplime";
  const description = guide
    ? guide.description
    : guidesIndex
      ? "Original guides for New Jersey homeowners: compare estimates, prepare for cleaning, plan junk removal, and ask better questions before hiring a professional."
      : profile
        ? profile.bio.slice(0, 160)
        : category
          ? serviceSeoContent[category].description
          : information
            ? information.description
            : servicesIndex
              ? "Explore home-service categories, prepare a useful project request, and compare approved professional profiles and written estimates on Aplime."
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
    logo: siteUrl + "/icon-512.png",
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
  if (guide || guidesIndex) {
    graph.push(
      guide
        ? {
            "@type": "BlogPosting",
            "@id": canonical + "#article",
            headline: guide.title,
            description,
            url: canonical,
            mainEntityOfPage: canonical,
            datePublished: guideDate,
            dateModified: guideDate,
            author: { "@id": organization["@id"] },
            publisher: { "@id": organization["@id"] },
            articleSection: guide.category,
            inLanguage: "en-US",
          }
        : {
            "@type": "CollectionPage",
            "@id": canonical + "#page",
            name: title,
            description,
            url: canonical,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: homeGuides.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.title,
                url: siteUrl + guidePath(item),
              })),
            },
          },
    );
    graph.push(
      breadcrumbSchema(siteUrl, [
        { name: "Home", path: "/" },
        { name: "Homeowner guides", path: "/blog" },
        ...(guide ? [{ name: guide.title, path }] : []),
      ]),
    );
  } else if (profile) {
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
            addressLocality: profile.details.city,
            addressRegion: profile.details.state,
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
  } else if (category) {
    graph.push({
      "@type": "Service",
      "@id": canonical + "#service",
      name: serviceSeoContent[category].title,
      serviceType: category + " services",
      description,
      url: canonical,
      areaServed: { "@type": "Country", name: "United States" },
      provider: { "@id": organization["@id"] },
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
          url: siteUrl + "/services/" + serviceSlug(item),
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
      "@type":
        path === "/faq"
          ? "FAQPage"
          : path === "/contact"
            ? "ContactPage"
            : "WebPage",
      "@id": canonical + "#page",
      name: information.title,
      description,
      url: canonical,
      isPartOf: { "@id": siteUrl + "/#website" },
      ...(path === "/faq"
        ? {
            mainEntity: generalFaqs.flatMap((group) =>
              group.items.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            ),
          }
        : {}),
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
          <PublicPage
            path={path}
            profile={profile}
            supportEmail={config.supportEmail}
          />,
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
      '"/><meta property="og:type" content="' +
      (guide ? "article" : "website") +
      '"/><meta property="og:image" content="' +
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
      serialize({ path, profile }) +
      ";</script>",
  };
}
