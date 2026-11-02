# New Jersey local directory

## Canonical routes

| Page | Pattern | Example |
| --- | --- | --- |
| State | `/nj` | `/nj` |
| County | `/nj/counties/<county>` | `/nj/counties/morris` |
| Municipality | `/nj/<municipality>` | `/nj/parsippany`, `/nj/newark`, `/nj/jersey-city` |
| Municipality + service | `/nj/<municipality>/<service>` | `/nj/parsippany/plumbing` |
| County + service | `/nj/counties/<county>/<service>` | `/nj/counties/morris/plumbing` |
| Service | `/services/<service>` | `/services/plumbing` |
| Business | `/professionals/<existing-id>` | Existing profile URLs stay unchanged |

These are route capabilities, not a promise that each example is published. No ZIP landing pages, alias permutations, new profile slugs, or existing-URL migration are introduced. ZIP codes are user-entered strings passed to `/app/projects/new?category=Plumbing&zip=07054`. Never preselect a single ZIP for an entire municipality. The existing intake checks service eligibility and the actual address; directory membership does not bypass matching.

The three initial municipalities are registry records only. They do not imply business coverage. The registry stores stable internal IDs, official names, public display names, counties, canonical slugs, and official source links. Review additions against the NJ municipality directory: https://www.nj.gov/nj/gov/county/localgov.shtml . ZIP/postal place names are not municipality boundaries.

Use lowercase hyphenated slugs. Keep established common display names such as Parsippany, with the official Parsippany-Troy Hills Township name recorded separately. Keep `jersey-city` because City is part of the common name. For ambiguous municipalities, include borough/township and county when necessary (for example, a future `washington-township-morris`); never collapse different places with the same name. Choose St./Saint using the official/common municipal name and freeze the slug. Only add a 301 alias for a genuine equivalent name after review; do not redirect arbitrary ZIPs or unsupported towns. Use category nouns such as `plumbing` in URLs, and natural phrases such as “Plumbers serving Parsippany, NJ” in headings.

## Publication policy

Minimums are Aplime editorial rules, not Google ranking requirements:

| Page | Minimum live coverage |
| --- | --- |
| NJ hub | One eligible business with reviewed NJ coverage to index; honest noindex hub otherwise |
| City-service | Three distinct eligible businesses for that service in that municipality |
| City | Five distinct eligible businesses across at least three services |
| County / county-service | Five distinct eligible businesses across at least three municipalities in the county (same service for county-service) |

Every city/county page also needs explicit editorial publication approval. Thresholds alone do not publish pages. The initial registry has only one municipality in each represented county, so county pages cannot qualify yet. Expand the registry only when real supply supports expansion.

Unknown and never-published paths return 404, not redirects to a generic form. Previously approved pages losing supply stay usable with an honest limited/empty state, `noindex,follow`, and are excluded from the sitemap and local navigation. Reassess such pages within 30 days; retain for users if useful, or remove their publication record to return 404. Never add robots.txt disallow to these pages: crawlers must see noindex. Nonproduction always remains noindex.

## Coverage approval and publishing workflow

The launch uses a small, code-reviewed **server-only manifest**, `src/server/local-directory-approved.ts`, rather than adding a public editing API or allowing arbitrary pro-entered city text to publish pages. This makes every coverage and publication change traceable through Git review. No database migration or new environment variable is required. Do not put private evidence, passwords, or customer information in this manifest: use an internal review reference only.

1. Ask the business to confirm the municipality and service it actually serves. Review its current radius, base location, categories, exclusions, and published profile. A large radius or matching postal ZIP alone is not evidence of full-city coverage. Record evidence in the private operational review system. Approve one entry per **business + municipality + service**. Branches of the same business must not be used to inflate supply.
2. On the appropriate environment's API shell, get the current preferences fingerprint:

   ```powershell
   npm run seo:check -- --pro "ACTUAL_PRO_USER_ID"
   ```

   The command is read-only. It reports only eligible businesses, their public categories, and a hash. It does not grant coverage or access.
3. Add an `approvedCoverage` record with the actual `proId`, registry `municipalityId`, exact service label, UTC ISO `reviewedAt` and `expiresAt`, internal `evidenceReference`, and returned `preferenceFingerprint`. Expiry must be at most 90 days after review. Never add fabricated seed/sample entries. The committed manifest starts empty deliberately.
4. Deploy reviewed coverage to development first and check the candidate path:

   ```powershell
   npm run seo:check -- --page /nj/parsippany/plumbing
   ```

   This reports distinct businesses, services, municipalities and supply qualification. It exits nonzero when supply fails. Verify these are independent real businesses and the rendered page would help someone compare providers.
5. Only after the threshold and editorial review pass, add `{ path, reviewedAt, evidenceReference }` to `approvedLocationPages`. Deploy through the normal development → stagging → main process. Environment-specific business IDs will naturally not match another database: repeat evidence and checks with the actual production IDs before production publication. Do not assume development qualification proves production supply.
6. Verify the actual public page, page source, canonical, noindex/index status, links, and sitemap. Submit the production sitemap to Search Console/Bing. Inspect indexed pages; no ranking or indexing is guaranteed.

At runtime, API queries require identity verification, reviewed/listed profile, available status, not suspended/deleted, and active/trialing subscription. Coverage must match both current and published categories. Changes to category, ZIP, radius, address/place ID, city/state or service-area text invalidate the approval fingerprint. Expired approval is omitted. Evidence and fingerprints are never returned in the public API. Only an explicit allowlist of public business fields and up to three approved portfolio thumbnails is returned.

Run the checks again after preference or coverage changes. Review expiry weekly; review publication usefulness monthly. A future admin workflow can replace the manifest without changing URLs or these gates.

## Rendering, linking and search metadata

- Public location pages are server-rendered; hydration uses the same data. They show real businesses before login, actual reviews counts (or “No reviews yet”), approved portfolio photos, profile links, and a ZIP-to-intake form.
- Main public navigation links to `/nj`. The state hub links to qualifying approved county/city/service combinations. Service pages link to qualifying local pages for that service; local pages link to existing service pages and profiles. Breadcrumbs link to available parents. No dead city links are generated just because a registry entry exists.
- Local titles describe the service and place with the Aplime brand; H1s use “serving” rather than claiming a physical office there. Descriptions are concise summaries, not fabricated local facts. Google may rewrite titles/snippets; character lengths are editorial targets, not hard Google limits.
- Structured data uses `CollectionPage`, actual `ItemList` entries and breadcrumbs. Existing service schema now identifies New Jersey, not the United States. Do not claim licenses, insurance, background checks or service guarantees based on identity verification.
- The existing `/sitemap.xml` includes only qualifying canonical local URLs, alongside existing services/info/profiles. No extra sitemap files are necessary at this launch size. Split into a sitemap index when volume requires it. No invented lastmod dates.
- Location HTML is revalidated on each request; the catalog API is no-store. Sitemap cache is 60 seconds. Catalog lookup failure returns 503 rather than publishing a false empty inventory. API must be deployed before the new web version. If local inventory grows substantially, introduce a short invalidatable catalog cache and paginated server-rendered listings before increasing the catalog size.

## Rollout

1. Foundation: deploy API/web, inspect `/nj`, and verify the empty honest state. Do not populate pages solely to target keywords. Complete actual coverage reviews.
2. First clusters: publish only cities/services that qualify. Prioritize depth in a few municipalities over all NJ combinations. Verify a real customer can reach profiles, preserve ZIP `07054`, and complete intake without false availability claims.
3. Expansion: add reviewed municipality records as supply grows; publish county pages only after breadth thresholds pass. Measure qualified requests and provider response, not just indexed URL count. Avoid copied city prose, fake reviews, ZIP permutations, and thousands of doorway pages directing visitors to the same form.
