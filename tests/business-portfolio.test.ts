import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessDisplay } from "../src/client/business-display.js";
import { BusinessPortfolio } from "../src/client/business-portfolio.js";
import {
  portfolioImages,
  type BusinessImage,
} from "../src/shared/business-images.js";
import type { Profile } from "../src/shared/domain.js";

test("customer profile presents approved portfolio photos before business details and exposes all twenty", () => {
  const images: BusinessImage[] = Array.from({ length: 20 }, (_, i) => ({
    id: `work-${20 - i}`,
    slot: `work-${20 - i}` as BusinessImage["slot"],
    url: `https://example.invalid/work-${20 - i}.jpg`,
  }));
  const profile: Profile = {
    id: "fixture",
    name: "Owner",
    business: "Fixture business",
    category: "Cleaning",
    bio: "Business description",
    zip: "08859",
    rate: 50,
    verified: true,
    suspended: false,
    listed: true,
    available: true,
    availability: [],
    rating: 0,
    reviewCount: 0,
    serviceRadiusMiles: 30,
    reviewStatus: "approved",
    address: "PRIVATE ADDRESS",
    placeId: "private",
    serviceCategories: ["Cleaning"],
    weeklyHours: {},
    timeZone: "America/New_York",
    images,
  };
  const html = renderToStaticMarkup(
    createElement(BusinessDisplay, { profile }),
  );
  assert.ok(
    html.indexOf('aria-label="Past work portfolio"') <
      html.indexOf("About Fixture business"),
  );
  assert.match(html, /20 photos/);
  assert.match(html, /View all photos/);
  assert.match(html, /\+15 more photos/);
  assert.ok(html.indexOf("work-1.jpg") < html.indexOf("work-2.jpg"));
  assert.ok(!html.includes("PRIVATE ADDRESS"));
  assert.equal(portfolioImages(images).length, 20);
  assert.equal(portfolioImages(images)[19].slot, "work-20");
});
test("branding is separate from past work and an empty portfolio is explicit without invented photos", () => {
  const images: BusinessImage[] = [
    { id: "logo", slot: "logo", url: "https://example.invalid/logo.jpg" },
    { id: "ad", slot: "cover", url: "https://example.invalid/ad.jpg" },
  ];
  const html = renderToStaticMarkup(
    createElement(BusinessPortfolio, { images, business: "Business" }),
  );
  assert.equal(portfolioImages(images).length, 0);
  assert.match(html, /hasn’t published past-work photos yet/);
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("View all photos"));
});
