import { createHash } from "node:crypto";
import { categories } from "../shared/domain.js";
import { municipalities } from "../shared/local-directory.js";
import type { CoverageApproval } from "./local-directory-approved.js";

export function preferenceFingerprint(row: Record<string, any>) {
  const fields = (p: Record<string, any>) => ({
    category: p.category,
    categories: [...(p.service_categories || [])].sort(),
    zip: p.zip,
    radius: p.service_radius_miles,
    address: p.address,
    placeId: p.place_id,
    city: p.details?.city,
    state: p.details?.state,
    serviceAreas: p.details?.serviceAreas,
  });
  return createHash("sha256")
    .update(
      JSON.stringify({
        current: fields(row),
        published: fields({ ...row, ...row.published_profile }),
      }),
    )
    .digest("hex");
}
export function validCoverage(
  approval: CoverageApproval,
  fingerprint: string,
  services: string[],
  now = Date.now(),
) {
  const reviewed = Date.parse(approval.reviewedAt),
    expiry = Date.parse(approval.expiresAt);
  return (
    municipalities.some((m) => m.id === approval.municipalityId) &&
    categories.some((c) => c === approval.service) &&
    services.includes(approval.service) &&
    approval.evidenceReference.trim().length > 0 &&
    approval.preferenceFingerprint === fingerprint &&
    Number.isFinite(reviewed) &&
    reviewed <= now &&
    expiry > now &&
    expiry > reviewed &&
    expiry - reviewed <= 90 * 24 * 60 * 60 * 1000
  );
}
