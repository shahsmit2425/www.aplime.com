import test from "node:test";
import assert from "node:assert/strict";
import { renderPage } from "../src/entry-server.js";
import { fallbackConfig } from "../src/shared/config.js";
import { categories, type Profile } from "../src/shared/domain.js";
import { informationalPages } from "../src/shared/seo-content.js";
const production = {
  ...fallbackConfig,
  environment: "production" as const,
  siteUrl: "https://aplime.com",
};
test("public service routes contain useful server rendered content and production SEO metadata", () => {
  const page = renderPage("/services/plumbing", production);
  assert.equal(page.status, 200);
  assert.match(page.html, /Plumbing Services and Repairs/);
  assert.match(page.html, /Leaking faucets, pipes, and fixtures/);
  assert.match(page.html, /What should a plumbing estimate include/);
  assert.match(page.head, /index,follow/);
  assert.match(page.head, /https:\/\/aplime.com\/services\/plumbing/);
  assert.match(page.head, /Plumbing Services and Repairs \| Aplime/);
  assert.match(page.head, /application\/ld\+json/);
  assert.match(page.head, /summary_large_image/);
  assert.match(page.head, /BreadcrumbList/);
  assert.match(page.head, /"@type":"Service"/);
});
test("every SEO landing page has unique metadata, useful copy, and valid structured data", () => {
  const paths = [
    "/",
    "/services",
    ...categories.map((category) => "/services/" + category.toLowerCase()),
    ...Object.keys(informationalPages),
  ];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of paths) {
    const page = renderPage(path, production);
    assert.equal(page.status, 200, path);
    assert.ok(page.html.length > 500, path);
    const title = page.head.match(/<title>(.*?)<\/title>/)?.[1];
    const description = page.head.match(
      /<meta name="description" content="(.*?)"\/>/,
    )?.[1];
    const json = page.head.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/,
    )?.[1];
    assert.ok(title, path);
    assert.ok(description && description.length >= 100, path);
    assert.ok(json, path);
    assert.equal(JSON.parse(json!)["@context"], "https://schema.org", path);
    assert.match(
      page.head,
      new RegExp(`https://aplime\\.com${path === "/" ? "/" : path}`),
    );
    assert.equal(titles.has(title!), false, `duplicate title: ${title}`);
    assert.equal(
      descriptions.has(description!),
      false,
      `duplicate description: ${description}`,
    );
    titles.add(title!);
    descriptions.add(description!);
  }
});
test("staging and private routes are never indexable", () => {
  assert.match(
    renderPage("/", { ...fallbackConfig, environment: "stagging" }).head,
    /noindex,nofollow/,
  );
  assert.match(
    renderPage("/app/projects", {
      ...fallbackConfig,
      environment: "production",
    }).head,
    /noindex,nofollow/,
  );
  assert.equal(renderPage("/not-a-real-page", fallbackConfig).status, 404);
});
test("approved professional pages expose truthful local business metadata", () => {
  const profile: Profile = {
    id: "professional-1",
    name: "Account owner",
    business: "Green Home Repair",
    category: "Handyman",
    bio: "Home repair and installation services with clear written project estimates.",
    zip: "10001",
    rate: 75,
    verified: true,
    suspended: false,
    available: true,
    availability: ["Mon"],
    rating: 4.8,
    reviewCount: 12,
    serviceRadiusMiles: 25,
    reviewStatus: "approved",
    images: [
      {
        id: "image-1",
        slot: "logo",
        url: "https://api.aplime.com/api/business-images/image-1",
      },
    ],
    details: {
      legalName: "Green Home Repair LLC",
      phone: "+1 212 555 0100",
      email: "hello@example.com",
      website: "https://example.com",
      city: "New York",
      state: "NY",
      serviceAreas: "Manhattan and nearby neighborhoods",
      specialties: "Mounting and minor repairs",
      languages: "English",
      hours: "Monday through Friday",
      license: "",
      insurance: "",
      qualifications: "",
      warranty: "",
      cancellationPolicy: "Please give 24 hours notice.",
      yearsExperience: 8,
      teamSize: 2,
      businessType: "LLC",
    },
  };
  const page = renderPage("/professionals/professional-1", production, profile);
  assert.equal(page.status, 200);
  assert.match(page.head, /Green Home Repair \| Handyman in New York, NY/);
  assert.match(page.head, /"@type":"ProfessionalService"/);
  assert.match(page.head, /"ratingValue":4.8/);
  assert.match(page.head, /"addressLocality":"New York"/);
  assert.match(page.html, /Green Home Repair/);
});
test("bootstrap JSON cannot break out of a script tag", () => {
  const page = renderPage("/", {
    ...fallbackConfig,
    supportEmail: "</script><script>alert(1)</script>",
  });
  assert.ok(!page.bootstrap.includes("</script><script>"));
  assert.match(page.bootstrap, /\\u003c/);
});
