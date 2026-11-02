import test from "node:test";
import assert from "node:assert/strict";
import {
  directoryPaths,
  emptyDirectory,
  locationPage,
  municipalities,
  qualifies,
  type LocalDirectory,
  type LocalListing,
  type LocalPro,
} from "../src/shared/local-directory.js";
import {
  preferenceFingerprint,
  validCoverage,
} from "../src/server/local-coverage-policy.js";
import { renderPage } from "../src/entry-server.js";
import { fallbackConfig } from "../src/shared/config.js";

const config = {
  ...fallbackConfig,
  environment: "production" as const,
  siteUrl: "https://aplime.com",
};
const pro = (id: string): LocalPro => ({
  id,
  business: `Test business ${id}`,
  bio: "Fixture only",
  category: "Plumbing",
  serviceCategories: ["Plumbing"],
  rating: 0,
  reviewCount: 0,
});
const listing = (
  id: string,
  service = "Plumbing",
  municipalityId: string = municipalities[0].id,
): LocalListing => ({ pro: pro(id), service, municipalityId });
const path = "/nj/parsippany/plumbing";

test("local paths accept registry municipalities and canonical services only, never ZIP aliases", () => {
  for (const p of [
    "/07054/plumbing",
    "/nj/07054/plumbing",
    "/nj/parsippany/plumber",
    "/nj/newark/cleaning/extra",
    "/nj/unknown",
    "/nj/newark/",
    "/nj/counties/unknown",
  ])
    assert.equal(locationPage(p), undefined, p);
  assert.equal(locationPage("/nj/jersey-city/hvac")?.service, "HVAC");
  assert.equal(
    locationPage("/nj/counties/morris/plumbing")?.name,
    "Morris County",
  );
});
test("city-service threshold counts distinct real business IDs, and requires publication", () => {
  const directory: LocalDirectory = {
    listings: [listing("1"), listing("1"), listing("2")],
    publishedPaths: [path],
  };
  assert.equal(qualifies(locationPage(path)!, directory), false);
  directory.listings.push(listing("3"));
  assert.equal(qualifies(locationPage(path)!, directory), true);
  assert.ok(directoryPaths(directory).includes(path));
  directory.publishedPaths = [];
  assert.ok(!directoryPaths(directory).includes(path));
  assert.equal(renderPage(path, config, undefined, directory).status, 404);
});
test("city and county thresholds require breadth, not duplicated category or coverage rows", () => {
  const directory: LocalDirectory = {
    listings: ["1", "2", "3", "4", "5"].map((id) => listing(id)),
    publishedPaths: [],
  };
  assert.equal(qualifies(locationPage("/nj/parsippany")!, directory), false);
  directory.listings.push(listing("1", "Cleaning"), listing("2", "Electrical"));
  assert.equal(qualifies(locationPage("/nj/parsippany")!, directory), true);
  assert.equal(
    qualifies(locationPage("/nj/counties/morris")!, directory),
    false,
  );
  directory.listings.push(
    listing("1", "Plumbing", municipalities[1].id),
    listing("2", "Plumbing", municipalities[2].id),
  );
  assert.equal(
    qualifies(locationPage("/nj/counties/morris/plumbing")!, directory),
    false,
    "other counties must not count",
  );
});
test("SSR, sitemap and hydration agree; lost supply is useful noindex, not a redirect", () => {
  const directory: LocalDirectory = {
    listings: [listing("1"), listing("2"), listing("3")],
    publishedPaths: [path],
  };
  const rendered = renderPage(path, config, undefined, directory);
  assert.equal(rendered.status, 200);
  assert.match(rendered.head, /index,follow,max-image/);
  assert.match(rendered.head, /Plumbers serving Parsippany, NJ/);
  assert.match(rendered.head, /CollectionPage/);
  assert.match(rendered.html, /Test business 1/);
  assert.match(rendered.html, /name="zip"/);
  assert.match(rendered.html, /name="category" value="Plumbing"/);
  assert.doesNotMatch(rendered.html, /value="07054"/);
  assert.match(rendered.bootstrap, /"directory"/);
  directory.listings = [];
  assert.equal(renderPage(path, config, undefined, directory).status, 200);
  assert.match(
    renderPage(path, config, undefined, directory).head,
    /noindex,follow/,
  );
  assert.deepEqual(directoryPaths(directory), []);
  assert.equal(
    renderPage("/nj", config, undefined, emptyDirectory).status,
    200,
  );
  assert.match(
    renderPage("/nj", config, undefined, emptyDirectory).head,
    /noindex,follow/,
  );
  assert.match(
    renderPage(
      path,
      { ...config, environment: "development" },
      undefined,
      directory,
    ).head,
    /noindex,nofollow/,
  );
});
test("coverage expires and changes to preferences immediately invalidate its fingerprint", () => {
  const row = {
    category: "Plumbing",
    service_categories: ["Plumbing"],
    zip: "07054",
    service_radius_miles: 10,
  };
  const fingerprint = preferenceFingerprint(row);
  const approval = {
    proId: "1",
    municipalityId: municipalities[0].id,
    service: "Plumbing",
    reviewedAt: "2026-11-01",
    expiresAt: "2026-12-01",
    evidenceReference: "test fixture",
    preferenceFingerprint: fingerprint,
  };
  const now = Date.parse("2026-11-02");
  assert.equal(validCoverage(approval, fingerprint, ["Plumbing"], now), true);
  assert.equal(
    validCoverage(
      approval,
      preferenceFingerprint({ ...row, service_radius_miles: 5 }),
      ["Plumbing"],
      now,
    ),
    false,
  );
  assert.equal(validCoverage(approval, fingerprint, ["Cleaning"], now), false);
  assert.equal(
    validCoverage(
      approval,
      fingerprint,
      ["Plumbing"],
      Date.parse("2026-12-02"),
    ),
    false,
  );
  assert.equal(
    validCoverage(
      { ...approval, expiresAt: "2027-12-01" },
      fingerprint,
      ["Plumbing"],
      now,
    ),
    false,
  );
  assert.equal(
    validCoverage(
      { ...approval, reviewedAt: "bad" },
      fingerprint,
      ["Plumbing"],
      now,
    ),
    false,
  );
});
test("public metadata and bootstrap safely escape business content", () => {
  const dangerous = listing("1");
  dangerous.pro.business = "</script><script>alert(1)</script>";
  const rendered = renderPage(path, config, undefined, {
    listings: [dangerous, listing("2"), listing("3")],
    publishedPaths: [path],
  });
  assert.doesNotMatch(rendered.bootstrap, /<script>alert/);
  assert.doesNotMatch(rendered.head, /<script>alert/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(renderPage("/services/plumbing", config).head, /New Jersey/);
  assert.doesNotMatch(
    renderPage("/services/plumbing", config).head,
    /United States/,
  );
});
