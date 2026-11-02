import {
  approvedCoverage,
  approvedLocationPages,
} from "./local-directory-approved.js";
import { localDirectoryProfiles } from "./repository.js";
import {
  preferenceFingerprint,
  validCoverage,
} from "./local-coverage-policy.js";
import {
  locationPage,
  type LocalDirectory,
  type LocalPro,
} from "../shared/local-directory.js";

export async function publicLocalDirectory(): Promise<LocalDirectory> {
  const profiles = await localDirectoryProfiles([
    ...new Set(approvedCoverage.map((a) => a.proId)),
  ]);
  const listings: LocalDirectory["listings"] = [];
  for (const { row, profile } of profiles) {
    const fingerprint = preferenceFingerprint(row);
    const currentServices = row.service_categories?.length
      ? row.service_categories
      : [row.category];
    const services = profile.serviceCategories.filter((s) =>
      currentServices.includes(s),
    );
    const pro: LocalPro = {
      id: profile.id,
      business: profile.business,
      bio: profile.bio,
      category: profile.category,
      serviceCategories: services,
      rating: profile.rating,
      reviewCount: profile.reviewCount,
      images: profile.images?.filter((i) => /^work-/.test(i.slot)).slice(0, 3),
    };
    for (const approval of approvedCoverage.filter(
      (a) => a.proId === profile.id,
    )) {
      if (validCoverage(approval, fingerprint, services))
        listings.push({
          pro,
          municipalityId: approval.municipalityId,
          service: approval.service,
        });
    }
  }
  const publishedPaths = approvedLocationPages
    .filter(
      (p) =>
        locationPage(p.path) &&
        p.evidenceReference.trim() &&
        Number.isFinite(Date.parse(p.reviewedAt)) &&
        Date.parse(p.reviewedAt) <= Date.now(),
    )
    .map((p) => p.path);
  return { listings, publishedPaths };
}
