import { categories, type Profile } from "./domain.js";
import type { ServiceCategory } from "./service-questionnaires.js";
export const launchArea = {
  name: "New Jersey",
  region: "NJ",
  country: "US",
  path: "/new-jersey",
} as const;
export const servicePagePath = (category: string) =>
  "/services/" + category.toLowerCase();
export function townSlug(town: string) {
  return town
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function newJerseyBusinesses(profiles: Profile[]) {
  return profiles.filter(
    (p) =>
      p.region === "NJ" &&
      !!p.town?.trim() &&
      !p.suspended &&
      p.verified &&
      (p.reviewStatus === "approved" || p.listed),
  );
}
export function businessServices(profile: Profile) {
  return categories.filter((c) =>
    (profile.serviceCategories?.length
      ? profile.serviceCategories
      : [profile.category]
    ).includes(c),
  );
}
export type LocalServicePage = {
  town: string;
  slug: string;
  category: ServiceCategory;
  path: string;
  profiles: Profile[];
};
// Registry comes from eligible public businesses' resolved base localities, not a list of invented coverage claims.
export function localServicePages(profiles: Profile[]): LocalServicePage[] {
  const pages = new Map<string, LocalServicePage>();
  for (const p of newJerseyBusinesses(profiles)) {
    const town = p.town!.trim(),
      slug = townSlug(town);
    if (!slug) continue;
    for (const category of businessServices(p)) {
      const path = `/new-jersey/${slug}/${category.toLowerCase()}`;
      const page = pages.get(path) || {
        town,
        slug,
        category,
        path,
        profiles: [],
      };
      if (!page.profiles.some((f) => f.id === p.id)) page.profiles.push(p);
      pages.set(path, page);
    }
  }
  return [...pages.values()].sort(
    (a, b) =>
      a.town.localeCompare(b.town) || a.category.localeCompare(b.category),
  );
}
export function localServicePage(path: string, profiles: Profile[]) {
  return localServicePages(profiles).find((page) => page.path === path);
}
export function projectStartUrl(category?: string, town?: string) {
  const params = new URLSearchParams();
  if (category && categories.includes(category as ServiceCategory))
    params.set("category", category);
  if (town) params.set("town", town);
  return "/app/projects/new" + (params.size ? "?" + params.toString() : "");
}

/** Only fields needed by public listing cards enter the page bootstrap. */
export function publicListingProfiles(profiles: Profile[]): Profile[] {
  return newJerseyBusinesses(profiles).map((p) => ({
    id: p.id,
    business: p.business,
    category: p.category,
    bio: p.bio,
    zip: p.zip,
    town: p.town,
    region: p.region,
    rate: p.rate,
    serviceCategories: p.serviceCategories,
    serviceRadiusMiles: p.serviceRadiusMiles,
    verified: p.verified,
    suspended: p.suspended,
    available: p.available,
    listed: p.listed,
    reviewStatus: p.reviewStatus,
    reviewCount: p.reviewCount,
    rating: p.rating,
    images: p.images?.map(({ id, slot, url }) => ({ id, slot, url })),
    name: "",
    address: "",
    placeId: "",
    weeklyHours: {},
    timeZone: "America/New_York",
    availability: [],
  }));
}
