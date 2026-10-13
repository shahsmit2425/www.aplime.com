# SEO and domain deployment

## Rendering and index controls

Public pages are rendered on the web service so their headings, descriptions, links, and structured data are present in the initial HTML response. The customer workspace, administrator app, development website, and staging website remain `noindex,nofollow` in both metadata and HTTP headers.

Production exposes:

- `/services` and one New Jersey guide for every supported service category
- `/new-jersey` and inventory-backed `/new-jersey/<town>/<service>` pages
- `/about`, `/how-it-works`, `/for-professionals`, and `/trust-and-safety`
- approved public professional profiles
- `/robots.txt` and `/sitemap.xml`

The sitemap omits drafts, unapproved professionals, private pages, legal pages marked noindex, development, and staging. If the API is temporarily unavailable, the sitemap continues to serve the static public URLs instead of returning an error.

## Render production setup

The production web service is an SSR Node web service. Do not convert it to a static site; static hosting would lose the dynamic professional pages and server-generated metadata.

1. Set the production common environment group `SITE_URL` to exactly `https://aplime.com` with no trailing slash.
2. Keep development and staging `SITE_URL` values pointed to their own Render domains.
3. Attach `aplime.com` only to the production web service. The Blueprint declares the custom domain and disables the duplicate `onrender.com` hostname after the domain is attached.
4. In Cloudflare, create the DNS record Render displays during custom-domain setup. Keep Cloudflare SSL mode at **Full (strict)** after Render issues the certificate.
5. Do not attach the customer domain to the API or administrator service. Use separate HTTPS URLs for those services.
6. Confirm that `https://www.aplime.com` redirects to `https://aplime.com`. Render creates the paired hostname redirect when the root domain is attached.

The web server also redirects an unexpected production hostname to `SITE_URL` and removes duplicate trailing slashes with permanent `308` redirects. `/health` stays available to Render without a domain redirect.

## Deployment verification

The GitHub Render deployment script verifies all of the following after the web release becomes live:

- release SHA and environment match the pushed branch
- the home page contains the correct canonical URL and JSON-LD
- production `robots.txt` advertises the canonical sitemap
- the production sitemap contains service landing pages and `/new-jersey`, and the home page identifies New Jersey
- development and staging return `Disallow: /` and an `X-Robots-Tag: noindex` header

No additional environment variable is required for this SEO implementation.

## Search engine setup after the production domain is live

1. Create a Domain property for `aplime.com` in [Google Search Console](https://search.google.com/search-console/about).
2. Add Google's TXT verification record in Cloudflare DNS.
3. Submit `https://aplime.com/sitemap.xml` in Search Console.
4. Inspect the home page, `/services`, one service page, and one approved professional page with URL Inspection.
5. Validate service and professional JSON-LD with Google's [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/).
6. Add the site to [Bing Webmaster Tools](https://www.bing.com/webmasters/) and submit the same sitemap.

Search engines decide when and whether to index a page. Deployment and sitemap submission do not guarantee rankings or immediate indexing.

## Content standards

- Add a service or location page only when it gives users distinct, accurate information.
- Do not generate city pages without real local inventory and useful local content.
- Never publish fabricated reviews, ratings, addresses, credentials, prices, or availability.
- Keep profile descriptions and images supplied by the professional and gated by marketplace review.
- Update service guidance when the product workflow changes so metadata and visible page content remain consistent.

References: [Google Search SEO fundamentals](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [Google structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Render custom domains](https://render.com/docs/custom-domains), and [Render Blueprint specification](https://render.com/docs/blueprint-spec).


## New Jersey launch pages and local business inventory

The homepage, six service guides and professional recruitment page now describe the New Jersey launch. Existing service URLs are preserved. `/new-jersey` is the coverage hub. Links to town/service pages are generated from eligible public business profiles with a server-resolved New Jersey town and state, not from a fabricated town list. For example, `/new-jersey/parlin/cleaning` exists only if the public inventory includes an approved/listed, identity-verified, nonsuspended business based in Parlin with Cleaning in its service preferences and an active/trialing subscription. The API enforces subscription and listing eligibility before supplying inventory. The existing public feed limit of 200 businesses remains; pagination should be introduced before that limit becomes insufficient.

Town pages describe where businesses are based, show shared business cards and link to full profiles/portfolios. They do not claim a base address guarantees coverage for a customer's address. A project is matched using the existing category, service-area and eligibility rules. Temporary availability changes retain useful public URLs and display Not accepting new requests; backend actions still reject unavailable businesses. Removed/ineligible inventory no longer creates town paths or sitemap entries. Unknown town/service combinations return a real 404 with noindex. A transient API inventory failure returns 503 with no-store, noindex and Retry-After for town pages, while useful statewide guides remain available without listings. Sitemap generation falls back to static public URLs if the API is unavailable.

Metadata uses New Jersey service coverage and identifies Aplime as the marketplace/broker, not the service performer. Coverage and town pages include CollectionPage, ItemList and breadcrumb JSON-LD; business ratings remain based on actual reviews. Public listing bootstrap data includes only card fields, without private street addresses, place IDs, account names or review notes. Individual profile publication retains its existing reviewed public data policy. Schema does not promise rich-result eligibility or rankings.

Service/town project links carry their context into the existing project form. Only validated category and locality hints are saved in sessionStorage for up to one hour so sign-in navigation does not lose the request context; they are cleared after publishing. A saved project draft still takes precedence when resumed. The town hint is a prompt for the address field, not an authoritative location or a bypass of address selection. The API independently resolves the chosen Google place before saving.

## Deployment for locality-aware SEO

Deploy API first with the existing `npm run config:check && npm run db:migrate` pre-deploy command. Forward-only migration 017 adds public town/state fields to projects and profiles and backfills clearly formatted, previously resolved US addresses. Ambiguous or missing legacy addresses remain blank instead of guessing a town from ZIP. New project/profile saves use Google's structured locality and state components. No new environment variables, credentials or services are required. Shared modules/domain and migration changes select API, worker, web, admin and mobile through the existing affected-service rules.

Keep development and staging noindex. Promote to production through the existing reviewed branch workflow. Once production is live, submit `https://aplime.com/sitemap.xml` in Search Console and inspect `/new-jersey`, one service guide, a real town/service page and a public business profile. Validate structured data using Rich Results Test and Schema Markup Validator. The deployment script now checks the New Jersey hub and homepage content in addition to existing release/canonical/index controls.

Design references: [Google people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse), [structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) and [Schema.org Service/broker](https://schema.org/Service).
