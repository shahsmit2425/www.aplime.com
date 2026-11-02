// Reviewed production facts only. Empty intentionally: never invent coverage.
// Changes require evidence and code review; see docs/LOCAL_SEO.md.
export type CoverageApproval = {
  proId: string;
  municipalityId: string;
  service: string;
  reviewedAt: string;
  expiresAt: string;
  evidenceReference: string;
  // SHA-256 of current and published service preferences. Get via seo:check.
  preferenceFingerprint: string;
};
export type PageApproval = {
  path: string;
  reviewedAt: string;
  evidenceReference: string;
};
export const approvedCoverage: CoverageApproval[] = [];
// Retain published paths when supply drops: render useful noindex pages.
export const approvedLocationPages: PageApproval[] = [];
