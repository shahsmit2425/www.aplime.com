import { categories, type Profile } from "./domain.js";
import { serviceSlug } from "./service-questionnaires.js";

// Stable internal municipality IDs, not postal place names or ZIP boundaries.
export const municipalities = [
  {
    id: "nj-parsippany-troy-hills",
    slug: "parsippany",
    name: "Parsippany",
    officialName: "Parsippany-Troy Hills Township",
    county: "morris",
    countyName: "Morris",
    source: "https://www.parsippany.net/",
  },
  {
    id: "nj-newark",
    slug: "newark",
    name: "Newark",
    officialName: "City of Newark",
    county: "essex",
    countyName: "Essex",
    source: "https://www.newarknj.gov/",
  },
  {
    id: "nj-jersey-city",
    slug: "jersey-city",
    name: "Jersey City",
    officialName: "City of Jersey City",
    county: "hudson",
    countyName: "Hudson",
    source: "https://www.jerseycitynj.gov/",
  },
] as const;
export type LocalPro = Pick<
  Profile,
  | "id"
  | "business"
  | "bio"
  | "category"
  | "serviceCategories"
  | "rating"
  | "reviewCount"
  | "images"
>;
export type LocalListing = {
  municipalityId: string;
  service: string;
  pro: LocalPro;
};
export type LocationPage = {
  path: string;
  name: string;
  county?: string;
  municipalityId?: string;
  service?: string;
  kind: "state" | "county" | "city";
};
export type LocalDirectory = {
  listings: LocalListing[];
  publishedPaths: string[];
};
export const emptyDirectory: LocalDirectory = {
  listings: [],
  publishedPaths: [],
};

export function locationPage(path: string): LocationPage | undefined {
  if (path === "/nj") return { path, name: "New Jersey", kind: "state" };
  const parts = path.split("/");
  if (parts[1] !== "nj") return;
  const isCounty = parts[2] === "counties";
  if (
    parts.length !== (isCounty ? 4 : 3) &&
    parts.length !== (isCounty ? 5 : 4)
  )
    return;
  const place = municipalities.find((m) =>
    isCounty ? m.county === parts[3] : m.slug === parts[2],
  );
  if (!place) return;
  const slug = parts[isCounty ? 4 : 3];
  const service = slug
    ? categories.find((c) => serviceSlug(c) === slug)
    : undefined;
  if (slug !== undefined && !service) return;
  return {
    path,
    name: isCounty ? `${place.countyName} County` : place.name,
    county: place.county,
    municipalityId: isCounty ? undefined : place.id,
    service,
    kind: isCounty ? "county" : "city",
  };
}

export function pageListings(page: LocationPage, directory: LocalDirectory) {
  return directory.listings.filter(
    (l) =>
      (!page.service || page.service === l.service) &&
      (!page.municipalityId || page.municipalityId === l.municipalityId) &&
      (!page.county ||
        municipalities.find((m) => m.id === l.municipalityId)?.county ===
          page.county),
  );
}
export function uniquePros(listings: LocalListing[]) {
  return [...new Map(listings.map((l) => [l.pro.id, l.pro])).values()].sort(
    (a, b) => a.business.localeCompare(b.business),
  );
}
// Editorial minimums, not thresholds promised or specified by Google.
export function qualifies(page: LocationPage, directory: LocalDirectory) {
  const listings = pageListings(page, directory);
  const count = uniquePros(listings).length;
  if (page.kind === "state") return count > 0;
  if (page.kind === "county")
    return (
      count >= 5 && new Set(listings.map((l) => l.municipalityId)).size >= 3
    );
  if (page.service) return count >= 3;
  return count >= 5 && new Set(listings.map((l) => l.service)).size >= 3;
}
export function visibleLocation(page: LocationPage, directory: LocalDirectory) {
  return page.kind === "state" || directory.publishedPaths.includes(page.path);
}
export function indexableLocation(
  page: LocationPage,
  directory: LocalDirectory,
) {
  return visibleLocation(page, directory) && qualifies(page, directory);
}
export function directoryPaths(directory: LocalDirectory) {
  return [...new Set(["/nj", ...directory.publishedPaths])].filter((path) => {
    const page = locationPage(path);
    return page && indexableLocation(page, directory);
  });
}
export function servicePeople(service: string) {
  const names: Record<string, string> = {
    Plumbing: "Plumbers",
    Electrical: "Electricians",
    HVAC: "HVAC professionals",
    Roofing: "Roofers",
    Painting: "Painters",
    Handyman: "Handyman professionals",
    Cleaning: "Cleaning professionals",
    Landscaping: "Landscapers",
  };
  return names[service] || `${service} professionals`;
}
export function locationHeading(page: LocationPage) {
  return page.service
    ? `${servicePeople(page.service)} serving ${page.name}, NJ`
    : page.kind === "state"
      ? "Find home-service professionals in New Jersey"
      : `Home services in ${page.name}, NJ`;
}
export function locationDescription(page: LocationPage) {
  return `Browse ${page.service ? page.service.toLowerCase() : "home-service"} pros serving ${page.name}${page.kind === "state" ? "" : ", NJ"}. Compare profiles, request written estimates, and discuss your project on Aplime.`;
}
