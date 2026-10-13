import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { renderPage } from "../src/entry-server.js";
import { fallbackConfig } from "../src/shared/config.js";
import {
  localServicePages,
  projectStartUrl,
} from "../src/shared/new-jersey.js";
import { locationLabel, customerPreviewName } from "../src/shared/locations.js";
import { ProjectCard } from "../src/client/marketplace-cards.js";
import {
  projectIntent,
  clearProjectIntent,
} from "../src/client/project-intent.js";
import type { Profile, Project } from "../src/shared/domain.js";
const config = {
  ...fallbackConfig,
  environment: "production" as const,
  siteUrl: "https://aplime.com",
};
const pro: Profile = {
  id: "real-fixture",
  name: "Private account owner",
  business: "Parlin Home Care",
  category: "Cleaning",
  bio: "A real-profile test fixture for cleaning services and home care.",
  zip: "08859",
  town: "Parlin",
  region: "NJ",
  rate: 40,
  available: true,
  suspended: false,
  verified: true,
  listed: false,
  reviewStatus: "approved",
  reviewCount: 0,
  rating: 0,
  serviceCategories: ["Cleaning", "Handyman"],
  serviceRadiusMiles: 30,
  address: "Private business street",
  placeId: "private-place",
  weeklyHours: {},
  timeZone: "America/New_York",
  availability: [],
  images: [
    {
      id: "work",
      slot: "cover",
      url: "https://example.invalid/past-work.jpg",
    },
  ],
};
test("town service registry only publishes supported categories with genuine eligible NJ inventory", () => {
  const profiles = [
    pro,
    { ...pro, id: "ny", region: "NY" },
    { ...pro, id: "hidden", suspended: true },
    { ...pro, id: "draft", reviewStatus: "draft" as const },
    { ...pro, id: "no-town", town: "" },
  ];
  const pages = localServicePages(profiles);
  assert.deepEqual(
    pages.map((p) => p.path),
    ["/new-jersey/parlin/cleaning", "/new-jersey/parlin/handyman"],
  );
  assert.ok(
    pages.every((p) => p.profiles.length === 1 && p.profiles[0].id === pro.id),
  );
  assert.equal(localServicePages([{ ...pro, verified: false }]).length, 0);
});
test("NJ town pages server render businesses, canonical metadata, context links and no private account data", () => {
  const page = renderPage("/new-jersey/parlin/cleaning", config, undefined, [
    pro,
  ]);
  assert.equal(page.status, 200);
  assert.match(page.head, /Cleaning Services in Parlin, NJ/);
  assert.match(page.head, /index,follow/);
  assert.match(page.head, /"@type":"City","name":"Parlin"/);
  assert.match(page.head, /BreadcrumbList/);
  assert.match(page.head, /https:\/\/aplime.com\/new-jersey\/parlin\/cleaning/);
  assert.match(page.html, /Parlin Home Care/);
  assert.match(page.html, /real-fixture/);
  assert.match(page.html, /category=Cleaning(?:&amp;|&)town=Parlin/);
  assert.match(page.html, /Confirm your address is covered/);
  assert.match(page.html, /past-work.jpg/);
  assert.doesNotMatch(
    page.html + page.bootstrap,
    /Private business street|private-place|Private account owner/,
  );
  assert.match(
    renderPage(
      "/new-jersey/parlin/cleaning",
      { ...config, environment: "development" },
      undefined,
      [pro],
    ).head,
    /noindex,nofollow/,
  );
});
test("unknown or unsupported town/service routes return 404, not a fabricated landing page", () => {
  for (const path of [
    "/new-jersey/parlin/plumbing",
    "/new-jersey/invented/cleaning",
    "/new-jersey/parlin",
    "/fake/cleaning",
    "/services/cleaning/extra",
  ]) {
    const page = renderPage(path, config, undefined, [pro]);
    assert.equal(page.status, 404, path);
    assert.match(page.head, /noindex,nofollow/);
    assert.match(page.html, /couldn’t find/);
  }
  assert.equal(
    renderPage("/new-jersey/parlin/cleaning", config, undefined, []).status,
    404,
  );
});
test("state hub stays useful without inventory and service schema identifies the marketplace accurately", () => {
  const hub = renderPage("/new-jersey", config);
  assert.equal(hub.status, 200);
  assert.match(hub.html, /Home services in New Jersey/);
  assert.match(hub.html, /Coverage depends/);
  assert.doesNotMatch(hub.html, /real-fixture|Parlin Home Care/);
  const service = renderPage("/services/cleaning", config);
  const graph = JSON.parse(
    service.head.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/,
    )![1],
  )["@graph"];
  const item = graph.find((x: any) => x["@type"] === "Service");
  assert.equal(item.areaServed.name, "New Jersey");
  assert.equal(item.areaServed["@type"], "State");
  assert.ok(item.broker);
  assert.equal(item.provider, undefined);
});
test("project cards show locality and customer name without rendering a street address", () => {
  const project = {
    id: "project",
    title: "Washroom cleaning",
    description: "Clean two washrooms",
    category: "Cleaning",
    zip: "08859",
    town: "Parlin",
    region: "NJ",
    customerName: "Smit S.",
    address: "Private customer street",
    status: "requested",
    urgency: "flexible",
    budgetMin: null,
    budgetMax: null,
  } as Project;
  const html = renderToStaticMarkup(
    createElement(ProjectCard, { project, onOpen: () => {} }),
  );
  assert.match(html, /Parlin, NJ · 08859/);
  assert.match(html, /Smit S\./);
  assert.doesNotMatch(html, /Private customer street/);
  assert.equal(locationLabel({ zip: "08859" }), "08859");
  assert.equal(
    locationLabel({
      zip: "08859",
      address: "21 Example Ave, Parlin, NJ 08859, USA",
    }),
    "Parlin, NJ · 08859",
  );
  assert.equal(customerPreviewName("Smit Shah"), "Smit S.");
  assert.equal(customerPreviewName(" Jordan "), "Jordan");
});
test("service and town intent survive sign-in, expire, ignore forged hints and clear after publishing", () => {
  const values = new Map<string, string>(),
    store = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, v: string) => {
        values.set(key, v);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  const url = projectStartUrl("Cleaning", "East Brunswick");
  const first = projectIntent(url.split("?")[1], store, 1000);
  assert.equal(first?.category, "Cleaning");
  assert.equal(first?.town, "East Brunswick");
  assert.deepEqual(projectIntent("", store, 2000), first);
  assert.equal(projectIntent("", store, 3601001), null);
  assert.equal(projectIntent("?category=admin&town=Secret", store, 4000), null);
  assert.equal(
    projectIntent("?category=Cleaning&town=<script>", store, 4000)?.town,
    undefined,
  );
  clearProjectIntent(store);
  assert.equal(projectIntent("", store, 5000), null);
});
test("locality migration backfills only clear resolved addresses and never guesses from ZIP", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE projects(address text,place_id text); CREATE TABLE profiles(address text,place_id text,verified boolean,suspended boolean);",
    );
    await db.query(
      "INSERT INTO projects VALUES($1,'resolved'),($2,''),($3,'resolved')",
      [
        "21 Example Ave, Parlin, NJ 08859, USA",
        "Unresolved address",
        "City unavailable",
      ],
    );
    await db.query("INSERT INTO profiles VALUES($1,'resolved',true,false)", [
      "Example Business, 12 Main St, East Brunswick, NJ 08816, USA",
    ]);
    await db.exec(
      await readFile(
        "src/server/db/migrations/017_public_localities.sql",
        "utf8",
      ),
    );
    const rows = (
      await db.query<{ town: string; region: string }>(
        "SELECT town,region FROM projects ORDER BY town DESC",
      )
    ).rows;
    assert.deepEqual(rows, [
      { town: "Parlin", region: "NJ" },
      { town: "", region: "" },
      { town: "", region: "" },
    ]);
    assert.equal(
      (await db.query<{ town: string }>("SELECT town FROM profiles")).rows[0]
        .town,
      "East Brunswick",
    );
  } finally {
    await db.close();
  }
});

test("temporary availability changes retain useful local URLs and display truthful status", () => {
  const off = { ...pro, available: false };
  assert.equal(localServicePages([off]).length, 2);
  const page = renderPage("/new-jersey/parlin/cleaning", config, undefined, [
    off,
  ]);
  assert.equal(page.status, 200);
  assert.match(page.html, /Not accepting new requests right now/);
});
