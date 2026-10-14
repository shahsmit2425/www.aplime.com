# SEO and domain deployment

## Rendering and index controls

Public pages are rendered on the web service so their headings, descriptions, links, and structured data are present in the initial HTML response. The customer workspace, administrator app, development website, and staging website remain `noindex,nofollow` in both metadata and HTTP headers.

Production exposes:

- `/services` and one detailed page for every supported service category
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
- the production sitemap contains service landing pages
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
