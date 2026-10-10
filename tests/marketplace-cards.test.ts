import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProjectCard,
  ProfessionalCard,
} from "../src/client/marketplace-cards.js";
import type { Project, Profile } from "../src/shared/domain.js";

test("project cards keep private street addresses out of listings and display exact budget amounts", () => {
  const project: Project = {
    id: "fixture",
    customerId: "customer",
    proId: null,
    title: "A project",
    description: "Description",
    category: "Painting",
    zip: "08859",
    address: "PRIVATE STREET ADDRESS",
    urgency: "this_week",
    propertyType: "home",
    budgetMin: 12345,
    budgetMax: 67890,
    scheduledAt: null,
    status: "paused",
    amount: null,
    createdAt: "2026-10-10T12:00:00Z",
  };
  const html = renderToStaticMarkup(
    createElement(ProjectCard, { project, onOpen: () => {} }),
  );
  assert.match(html, /On hold/);
  assert.match(html, /This week/);
  assert.match(html, /08859/);
  assert.match(html, /\$123\.45/);
  assert.match(html, /\$678\.90/);
  assert.doesNotMatch(html, /PRIVATE STREET ADDRESS/);
});
test("professional cards preserve fractional rates and do not imply verification or reviews for unfinished profiles", () => {
  const profile: Profile = {
    id: "fixture",
    name: "Test",
    business: "Test business",
    category: "Painting",
    bio: "Profile description",
    address: "PRIVATE STREET ADDRESS",
    placeId: "",
    zip: "08859",
    rate: 42.5,
    verified: false,
    suspended: false,
    listed: false,
    available: false,
    availability: [],
    rating: 0,
    reviewCount: 0,
    serviceRadiusMiles: 10,
    reviewStatus: "draft",
    serviceCategories: ["Painting"],
    weeklyHours: {},
    timeZone: "America/New_York",
  };
  const html = renderToStaticMarkup(
    createElement(ProfessionalCard, {
      profile,
      preview: true,
      save: null,
      actions: null,
    }),
  );
  assert.match(html, /No reviews yet/);
  assert.match(html, /Identity pending/);
  assert.match(html, /\$42\.5/);
  assert.match(html, /Business setup in progress/);
  assert.doesNotMatch(html, /Identity verified|PRIVATE STREET ADDRESS/);
});
