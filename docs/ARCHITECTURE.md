# Architecture

## Source layout

```text
apps/
  web/server.ts            Customer/pro website SSR process; reads only public API, never connects to database
  admin/                   Independent static admin app, sign-in, TOTP and administration screens
  api/server.ts            Dedicated backend process entry point
src/
  shared/                  Types, Zod validation, lifecycle permissions, public config contract
  client/
    workspace.tsx          Authenticated shell, routing, account lifecycle, refresh/error handling
    pages.tsx              Customer/provider workspace screens
    auth.ts                Firebase web auth + native Google/Apple credentials
    api.ts                 Bearer-token API client and native external-browser handling
    ui.tsx                 Shared accessible UI primitives
  public-page.tsx           Public landing, service, and professional pages
  entry-client.tsx          Hydration / native bootstrap
  entry-server.tsx          SEO rendering, metadata, safe JSON serialization
  styles.css               Shared responsive styles, readable colors and type
  server/
    index.ts               API HTTP server, CORS, security headers and API routes
    api.ts                 Authenticated API and integration endpoints
    projects.ts            Transactional project commands
    repository.ts          Role-scoped database reads, audit and notification outbox
    webhooks.ts            Signed/idempotent Stripe events
    config.ts              Server config validation and explicit public allowlist
    db/                    Postgres connection, migrations and schema
    integrations/          Firebase, Stripe, Daily, R2, Upstash, Maps, SMTP
    worker.ts              Durable email-outbox delivery with retries
android/                   Android native wrapper and signing configuration
ios/                       iOS native wrapper, Google/Apple integration and entitlements
config/environments.json   Branch → environment → mobile app identity
scripts/                   Deployment, configuration and mobile packaging
fastlane/                  TestFlight and Play distribution
tests/                     Lifecycle, authorization, SQL, webhook, SEO and pipeline tests
render.yaml                Three isolated web/worker/Postgres environments
```

## Data and authorization

Firebase proves identity. Every API request verifies the ID token, checks revocation and verified email, and loads the user's role from PostgreSQL. Registration accepts only customer or professional; an administrator additionally needs an approved UID, Firebase admin claim, database admin role, TOTP-authenticated token and authentication within the last hour. Public signup cannot create administrators. URL changes never change account permissions.

PostgreSQL stores users, profiles, projects, estimates, messages, payments, reviews, support tickets, notifications, blocked/saved relationships, private file references, audit events, webhook receipts and the email outbox. Migrations contain no INSERT statements for marketplace data. The legacy SQLite/localStorage preview is not loaded, migrated, or served.

Private workspace queries are scoped to the current user. Administrators can manage listings, cases and financial records but do not automatically receive private messages or project attachments. Public searches and profile pages only show verified, unsuspended listings. Provider opportunities omit customer identity until assignment.

Projects use requested → quoted → booked → in_progress → completed, with explicit cancellation/dispute paths. Commands lock the project row, validate actor and stage, and update quotes and notifications in the same transaction. Monetary totals are integer USD cents. Checkout prices come from the accepted estimate, never the browser. Each project can have one payment record and one review.

## Integrations and consistency

Stripe handles hosted Identity, Express Connect onboarding, Checkout destination charges, receipts and full refunds. Verification is updated only by matching a signed event to the stored verification session. Payment success is updated by signed webhooks, not a redirect. Event IDs, payment uniqueness and Stripe idempotency keys protect retries.

Daily issues project-specific private rooms and short-lived participant tokens. Calls open in the system/browser calling surface; camera and microphone permission is requested by that surface. This is a foreground calling flow, not native background ringing or push calling.

Photo uploads go through the API (`PUT .../content`), which checks ownership, type and size, then re-encodes the image with sharp (removing EXIF/GPS and other metadata) before writing to R2; there is no browser-to-R2 upload path. Buckets are private and downloads use short-lived signed URLs. Per-account creation limits live in `src/server/quotas.ts`, and account export/deletion in `src/server/account-data.ts`. Identity documents are never uploaded through R2.

Upstash provides shared per-user throttling; Express also limits requests per IP. PostgreSQL is the source of truth. The email worker consumes an outbox with row locks, exponential retry and an eight-attempt limit. Email delivery is at-least-once: a process failure after delivery but before acknowledgment can produce a duplicate alert.

The UI refreshes current data every ten seconds and on focus. This keeps web/mobile state consistent through the same backend; it is not a WebSocket push transport. Clients show loading/errors and do not claim success until the API succeeds.

## Environment model

All branches contain identical environment-independent application code after promotion. Runtime values come from Render groups. Web clients receive only the explicitly allowlisted `/api/config` fields. Mobile builds obtain that public config from the matching environment API and bundle it with the same source commit. Private keys are never embedded in JavaScript.

Native app code updates still require new signed builds and installation through the relevant store/test channel. Backend and website changes become available after Render deployment. There is no unsafe remote-code hot-patch mechanism.

## SEO and accessibility

Public landing, six service pages and verified professional profiles are server-rendered HTML with titles, descriptions, canonical links, Open Graph and JSON-LD. Sitemap URLs include real public profiles only. Non-production environments and private application routes are noindex; missing pages return 404. Do not treat robots directives as an access-control boundary.

The shared stylesheet uses dark headings and readable body colors, responsive navigation, visible focus outlines, form labels, status/error announcements, and reduced-motion support. No synthetic ratings, job counts or customer testimonials are displayed.

## Independent deployment graph

`apps/admin` edits deploy only the admin site. Customer client edits deploy web/mobile. API edits deploy the API, and worker dependencies also deploy the mail worker. Shared contracts or dependency/configuration changes deploy all affected apps. Database migrations run only on API releases. A documentation-only push deploys nothing. GitHub validation still checks the entire repository.

The API is a separately versioned compatible service: UI-only releases need not share its commit SHA. Breaking contracts require an expand/migrate/contract rollout; support installed native clients when retiring endpoints.

Each environment has common settings shared by every application service and backend settings linked only to API/worker. Frontend builds and runtimes receive no database/provider private credentials. Browser output remains explicitly allowlisted; neither frontend automatically exposes prefixed environment variables.
