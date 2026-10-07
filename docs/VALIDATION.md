## Stripe Identity failure diagnostics - October 6, 2026

The browser-reported POST 500 alone does not establish the live root cause. Identity create/retrieve errors now return safe provider-specific 503 messages and a validated Stripe request reference. Server logs record allowlisted error type, code, parameter, operation and status; raw provider messages and identity data are not retained. Read-only `identity:check` validates environment modes and checks Identity read access without creating a session or printing its contents. Creation idempotency keys now include a version and parameter fingerprint to avoid reuse with changed return URLs/options. Saved sessions remain intact on provider errors.

Regression coverage includes actual Stripe error classes, secret redaction, safe references, failed-create rollback, unavailable stored sessions, and identical versus changed retry parameters. All 87 tests passed. Live Render logs, Stripe activation/keys/permissions and the cause of the reported 500 remain unverified pending the actual server/provider error. This release has not been deployed.

## Business profile redesign and Stripe Identity flow - October 6, 2026

The saved business profile preview and customer/public profile share a brand header, content cards, full advertisement image with image dialog, contact links, services, rates, and a vertically readable weekly schedule. Request availability respects server eligibility. Mobile places project discussion actions before the remaining profile content. Private base addresses are not rendered. Browser review checked desktop and 390px viewport layouts using an isolated, labeled local fixture without database records or authentication bypass; no horizontal overflow was present.

Identity verification has a professional-only page at `/app/verification` and a return page at `/app/verification/return`. Authenticated start/resume responses optionally enable Stripe.js's in-website modal, with hosted fallback and native hosted flow. Status handles initial, resumed, needs-input, processing, awaiting webhook, canceled and verified sessions. Documents/selfies remain collected by Stripe. Returning from the hosted flow or finishing the modal never grants verification. Signed webhooks reconcile current Stripe state and ignore sessions no longer attached to the account.

Validation: TypeScript and web/SSR/admin builds passed; all 84 tests passed. Regression tests cover owner-only access, session reuse, server-chosen return URL and selfie checks, safe status responses, client-submitted verification rejection, canceled session replacement, delayed events, and webhook confirmation. Live Stripe modal/credentials/webhook delivery and signed native return behavior have not been verified. Capacitor asset/plugin sync passed for Android and iOS; CocoaPods/Xcode checks were unavailable on Windows. Git commit was blocked by permission denied for `.git/index.lock`; changes remain local on development. Render deployment remains pending.

## Independent business image selections - October 6, 2026

Logo and advertising image keep independent pending previews, errors and progress. Saving or discarding one preserves the other. Actual writes remain serialized; only the active card reports saving. Storage failures log only allowlisted provider codes/status and missing variable names, never credentials or raw provider messages.

Validation: 83 tests passed; TypeScript and web/SSR/admin builds passed. Live R2 credentials and authenticated browser interaction are not verified. Render configuration must be corrected before claiming upload recovery.

# Validation and launch status

## Business-image upload recovery and controls — October 6, 2026

The reported requests went directly from the browser to R2 and were blocked by the storage response's missing CORS headers. The new business-media client selects `transport=api`, reserves an owner-scoped pending image, and sends the file to the authenticated `PUT /api/profile/images/:id/content` endpoint. That endpoint writes to private R2 using server credentials; the browser no longer needs bucket CORS for business-image uploads. Existing direct-upload clients and project attachments retain their current flow and still need bucket CORS. Actual R2 credentials and bucket permissions remain necessary; the supplied URL appears to reuse the account ID as the access-key ID, which needs operator verification. No live credential changes or successful Render upload are claimed.

The upload route checks professional role, pending ownership, declared MIME/size and magic bytes, caps input at 10 MB without decompression, serializes profile mutations, rejects writes to completed images, and limits concurrent buffering to four files per API process/one per account. Storage writes time out after 60 seconds. Completion uses the existing object inspection and atomic replacement transaction; the saved image remains until completion succeeds. This is signature validation, not full image decoding or antivirus scanning. Safe storage errors expose a fixed code/message and HTTP status, not raw provider responses.

The UI now provides selection preview before Save, full-size dialog viewing, replacement, discard, explicit retry and delete confirmation. Completion retries avoid reuploading a file already acknowledged by the API. Delete requests include the image ID from the confirmation step so another session's replacement is not accidentally deleted. Existing work-photo management and R2 image delivery are preserved.

Local tests cover real Express routes with PGlite and a mocked S3 transport: authentication/role/ownership rejection, type/size/header rejection, oversized-body rejection, safe storage-error responses, old-image preservation, successful upload/completion, idempotent completion, completed-object write rejection, stale deletion and deletion cleanup. All 83 tests and TypeScript pass. Web/admin builds and native asset sync are checked separately; live browser/R2 behavior, proxy limits under production load, and signed mobile-device builds remain unverified. No environment variables or migrations are added. Release the API before or together with the customer client.

The supplied `/api/profile/identity` 500 is a separate unresolved error; its Render API log is needed to establish the cause. Upload changes do not alter Stripe verification.

## Simplified business profile — October 6, 2026

Based on the refreshed development checkout at `8735cb6`, preserving the Codespaces changes to listing visibility during re-review, R2 delivery, saved professionals and project actions. The editor now contains basic business details, two branding images, the shared weekly schedule, profile preview, and account setup. Required basic fields are business name, primary service, description, phone, email, starting rate, full base address and service radius; website is optional. Legal structure, team size, experience, duplicated location/hours text and credential questionnaires are no longer required to save. Previously stored metadata is preserved when editing basic details. Missing optional facts and empty detail groups are omitted from the customer profile.

The image editor defaults to logo and advertising image (existing storage slot `cover`). Existing portfolio images are preserved and can be managed through an expandable control. Review submission requires ready logo and cover images, not a portfolio photo; the client and API use the same branding rule. Identity/subscription/review authorization and the existing `listed` behavior remain in place. Scheduling reuses the existing preferences endpoint and validation, preserving service categories and radius when only hours are edited. Switching profile tabs keeps unfinished detail/schedule form values mounted.

Local checks: TypeScript, all 82 tests, and customer client/SSR plus admin builds pass. Regression tests cover the minimal details payload, legacy detail retention, contact/unknown-field validation and the two-image review requirement. No new environment variables or database migrations are introduced. Deploy API and customer client together so the shorter payload and changed image-review requirement are supported. Live authenticated form submissions, Google address lookup, R2 uploads, review submission, Render deployment and signed mobile-device behavior have not been verified. Tests use the existing outside-repository Windows Node userInfo workaround.

## Development listing preview — October 5, 2026

All 62 tests pass; TypeScript and customer client/SSR plus admin production builds pass. An isolated PGlite regression test verifies visibility of 501 incomplete business profiles and 101 open projects, including access for a pro account with no profile. It checks address/review-note redaction, blocking, suspension, project status exclusions, retained estimate authorization, unchanged public profile eligibility, the opt-out flag, and the staging/production guard. Fixtures never touch live data.

Preview is enabled by default only for development with open discovery. Set backend `MARKETPLACE_PREVIEW=false` and redeploy the API to return to ordinary eligibility and response limits; `MARKETPLACE_DISCOVERY_MODE=matched` also disables preview. Customer cards show preview status and inline business details rather than linking incomplete profiles to unavailable public pages. New chats/estimates still require normal business eligibility, and the UI explains this. Preview business image links are authenticated-workspace-issued, short-lived R2 signatures; address and administrator-review-note fields are omitted for nonowners.

No migration is required. Deploy the API and customer client together and refresh the page. Live Render database contents, authenticated browser journeys, R2 image access, and deployed results have not been verified here. Existing professionals must have saved a business profile to appear; the code creates no synthetic profiles.

## Address diagnostics and temporary open discovery — October 5, 2026

Local validation: all 61 tests pass; strict TypeScript, customer client/SSR and admin production builds pass. After the final discovery-query optimization, TypeScript and all 18 database integration tests pass again. Capacitor sync completes for Android and iOS shared assets/plugins; Windows has no CocoaPods/Xcode, so signed native builds and device behavior remain unverified. Commands use the existing outside-repository Node userInfo workaround.

`MARKETPLACE_DISCOVERY_MODE` defaults to `open`: customers can browse eligible businesses without a project, then choose an open project to chat; eligible professionals can browse and estimate projects across service/location preferences. Set `matched` on the API to restore restricted discovery. Approval, identity, subscription, availability, blocking, project ownership and lifecycle rules remain enforced. Private structured addresses and customer identity are omitted from discovery. Open opportunities remain limited to the latest 100, profile responses to 500. Existing pending estimates remain accessible for management. Preference-based notifications remain unchanged. Tests cover discovery before posting, cross-category/cross-ZIP estimates, both directions of blocking, each eligibility gate, closed/assigned project exclusion, privacy, notification targeting and switching back to matching. No database migration is introduced.

The reported generic autocomplete error hid all provider failures. Known address errors now return fixed public messages/codes, while server logs contain only HTTP status and allowlisted provider reasons. Missing credentials, denied configuration, quota, timeout/network errors, empty predictions, malformed payloads and unknown-error masking have test coverage. The input has a retry action and matches the API's 200-character search limit. No key or Google raw error is sent to clients. Whitespace around the server key is trimmed.

The specific live Render/Google cause is **not confirmed or repaired** by these local checks: there are no local provider credentials or active authenticated browser tabs. After deployment, run `npm run maps:check` in the API service's Render Shell and use the troubleshooting steps in ENVIRONMENT_VARIABLES.md. This command tests the service's Google configuration; authenticated full-form requests also depend on Firebase, Redis and PostgreSQL. No live deployment, Google billing/key change, or multi-account browser verification is claimed.

## Project lifecycle and notification coverage — October 4, 2026

Local result: `npm run check` passes strict TypeScript, all 59 tests and customer client/SSR plus admin production builds. `npx cap sync` succeeds for Android and iOS asset/plugin synchronization. CocoaPods and Xcode steps are unavailable on Windows. Checks use the temporary, uncommitted Node userInfo workaround described below.

Migration 009 introduces paused projects, the identity of the completion requester, cancellation agreements, project versions, personal archives, an activity timeline and withdrawn estimates. It must run before the new API. Deploy the API and shared client together; older open clients must refresh because action requests now include `expectedVersion`. No environment variables change.

Automated coverage includes both participants starting work and requesting completion; self-confirmation rejection; more-work requests; pause ownership and resumption; cancellation agreement, withdrawal and stale request IDs; personal archive/restore; removal of unassigned requests; withdrawn estimate revisions; activity privacy; and publication fanout to every eligible match independently of the five-card shortlist. A PostgreSQL-trigger test verifies no live notifications escape a rolled-back fanout. Tests use isolated PGlite data, never live marketplace accounts.

The existing authenticated SSE stream, bell/toast/unread counters, reconnect recovery and mail outbox are reused. Important project transitions now notify both assigned participants; opportunity closure alerts previous recipients without private reasons. Old workspace fetch responses are discarded so they cannot overwrite a newer screen. Email follows user settings. Closed-app push, browser push subscriptions, FCM/APNs, live Render delivery and signed-device behavior remain unverified/unimplemented as applicable.

The current local environment has no configured authenticated customer/pro session, so end-to-end multi-account browser checks against Firebase, Daily and Render remain a deployment validation task. No live deployment is claimed. Shared-client and Capacitor checks do not replace native device testing.

## Address, matching and calendar update — October 4, 2026

`npm run check` passes: strict TypeScript, all 53 tests, customer client/SSR and separate admin production builds. Tests cover Places API request/session handling and invalid addresses, category/radius matching with legacy ZIP fallback, a maximum of five customer matches per project, private address redaction, repeated customer chat creation, blocking, time zones/daylight saving, weekly-hours boundaries and conflicting appointments. Database fixtures remain isolated in PGlite; no marketplace demo data is added.

`npx cap sync` completes for Android and iOS. Windows cannot run CocoaPods or Xcode; signed builds, installed native apps and store releases are unverified. Local checks use the existing temporary Node userInfo workaround outside the repository. The browser smoke check confirms the homepage's Start a project link reaches the sign-in screen without console errors. Local authentication is not configured, so authenticated visual journeys, live Google billing/key restrictions, Daily media, SSE delivery and Render deployment still require development-environment validation.

Deployment: run migration `008_matching_preferences_and_addresses.sql` through the existing `npm run db:migrate` pre-deploy step before the new API and client serve traffic. Existing profile categories are retained; hours remain empty until each professional publishes actual hours. Enable Places API (New) on the project/key used by `GOOGLE_MAPS_SERVER_KEY` (see ENVIRONMENT_VARIABLES.md). There are no new environment variables. The exact-address requirement affects new projects and business-profile edits; existing projects remain readable.

This update replaces the earlier all-category browsing and notification behavior described in the historical sections below. Professionals now receive category/location matches, and customers see up to five eligible matches per open project. Weekly hours and one-hour appointment proposals are implemented; date-specific closures, variable-duration bookings and pre-hiring consultation calendars remain future work. Scheduling requires a selected professional and confirmation by the other participant. A proposed time is not a reservation; conflicts are checked again at confirmation. Foreground realtime notifications and private Daily calls reuse the existing integrations. No closed-app push or external calendar sync is claimed.

## Checked locally

- TypeScript strict compilation.
- Client production build and React server-rendering bundle.
- Automated tests: lifecycle permissions, registration/verification privilege boundaries, integer payment validation, date validation, private membership, SQL constraints, empty schema, role-scoped reads, signed/idempotent webhooks, SEO rendering/escaping, environment mapping and promotion guards.
- Database tests use PGlite, an embedded PostgreSQL engine, with isolated synthetic fixtures. They do not seed the application or contact real service accounts.
- Capacitor copies the shared bundle and discovers the Firebase Authentication and Browser plugins for Android/iOS.
- Dependency audit: zero reported vulnerabilities after updating the server/auth/mail tooling and Vite. The targeted gaxios → uuid override applies the patched UUID implementation to Firebase Admin's optional storage dependency.
- Browser smoke check: responsive public homepage and the configuration-aware authentication screen render without console errors. Unauthenticated workspace requests return 401; public config exposes only the documented allowlist.

The GitHub validation job also compiles the Android debug app. The refactor adds independent admin builds, selective-deployment checks and administrator claim/allowlist/role/TOTP/session-age denial tests. Native distribution uses Java 21 / Android API 36 and an Xcode 26-or-later check. Store policy and SDK requirements must be rechecked as platforms evolve.

## Requires external credentials and devices

Render deployment, managed Postgres TLS/migrations, Firebase/Google/Apple authentication, Stripe Identity/Connect/Checkout/refunds, Microsoft 365 SMTP delivery, Daily calls, Maps geocoding, R2 storage, Upstash and Sentry must be exercised with their actual service configuration.

Windows cannot perform an Xcode archive. No signed iOS archive, Android release bundle, TestFlight upload, or Google Play upload has been validated locally. CI is configured to do those steps after the required credentials exist.

## Before a public launch

Publish actual business terms/privacy/retention and support contact details in place of the informational pages. Complete App Store privacy/export-compliance declarations, Play Data Safety, tester setup, and the account-deletion process required by your distribution policy. Account/data deletion currently routes to a support case rather than an automated erasure pipeline.

Verify webhook destinations and replay behavior in Stripe test mode; confirm professional payout readiness. Test login, a full project-to-payment flow, private chat and a two-person call on both real mobile platforms. Monitor failed email-outbox attempts. Add operational retention/scanning policies for files according to your service requirements.

Current design limits: US ZIP-based location, USD-only pricing, one primary service category per professional, full refunds only, availability preferences rather than conflict-free scheduling, capped workspace histories (500 projects/1000 messages), polling rather than push, and foreground calls without native incoming-call ringing. These are explicit product boundaries, not simulated success paths.

References: [Android target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).

## Refactor verification boundary

The Aplime rename passes TypeScript, all 21 automated tests, and customer SSR/client plus admin builds. Capacitor synchronization completes on Windows; Xcode/CocoaPods steps still require macOS. Local checks used a temporary, uncommitted Node preload to handle the runner's failing Windows userInfo lookup; application code and CI do not use that workaround. SEO tests verify the configured aplime.com canonical URL. Mobile publishing now skips when MOBILE_RELEASES_ENABLED is not true, while native debug validation still runs. Live deployment requires the development commit to be pushed and successful Render health checks; local build success does not confirm a live release.

The admin static bundle and customer SSR bundle build independently. The API serves JSON and does not serve either frontend. Live administrator provisioning and Firebase TOTP enrollment/revocation require the environment credentials and Identity Platform setup. The admin login HTML is publicly retrievable; its data/actions require server authorization. No live Render resources, domains or privileged accounts are provisioned by this code change.

## Authentication continuity update

Repeat registration now attempts sign-in with the supplied credentials when Firebase reports an existing account. Verification controls are shown only after successful authentication. Invalid credentials do not expose the verification state. New-account email delivery errors retain the created Firebase session so resend is available.

Customer/pro browser login defaults to local persistence (survives browser restarts). Unchecking Keep me signed in uses Firebase session persistence for the current tab. There is no fixed app-imposed idle timeout. Firebase refreshes short-lived ID tokens; logout, cleared browser storage, revocation, disabled/deleted accounts or invalidated credentials can require sign-in again. The API checks revocation on every authenticated request; workspace 401 responses clear the local session. Admin authorization remains separately enforced with recent TOTP.

Verification is checked every five seconds while the page is visible, and on focus/visibility changes. A manual check and resend remain available; successful resend has a one-minute UI cooldown. Firebase's server-side limits remain authoritative. In-flight workspace results are discarded after an account change/logout.

Live Firebase email delivery, multi-tab persistence, account revocation and mobile background/resume must still be verified against the configured development Firebase project. Local tests exercise credential fallback and error boundaries; they do not establish live provider or Render deployment success.

## Subscription-only billing and business profiles

Project checkout and new Connect onboarding return HTTP 410. Customer payments and professional earnings navigation are replaced by professional subscriptions. Legacy payment records and signed reconciliation/refund handlers remain for historical transactions. Reviews depend on completed projects, not platform payment.

Expanded public business information is validated on the API and stored in profiles.details. Contact information is explicitly public; licensing and insurance are self-reported and are not represented as verified. No tax IDs, home street addresses, or identity documents are requested in the profile.

Live Stripe recurring price, Customer Portal configuration, webhook delivery, failed renewal, cancellation, resubscription, and Identity verification still require Stripe test-mode validation. Native purchases/distribution have not been validated; mobile releases remain deferred. Do not publish mobile subscription checkout until store policy and billing implementation are reviewed for the intended distribution.

## Customer project photos

Project creation offers up to five optional JPG/PNG/WebP images, 10 MB each, with previews and removal before submission. Uploads follow project creation; failures retain the saved project and reservation IDs while the form remains open, allowing retries without creating another project. Already completed photos are skipped. Reloading/leaving the form discards local file selections. Pending reservations count toward the five-image cap. Their owner can remove unfinished uploads from the project attachments section to release slots after leaving the form. Existing PDF project attachments remain supported separately.

The API serializes reservations with a project row lock, checks membership and ownership on retries/completion, and verifies object metadata before marking uploads ready. File checks cover declared MIME type and size, not antivirus scanning. Automated tests cover file validation and database reservation limits. Live authenticated browser/R2 uploads, bucket CORS, connection interruption, and signed mobile builds still need development-environment validation; local checks do not establish deployment success.

## Project collaboration redesign

Migration 004 adds private professional discussions, migrates existing assigned-project messages into the unified inbox, adds estimate revision numbers, appointment proposals, and customer-confirmed completion. Run `npm run db:migrate` before the updated API serves traffic. No new environment variables are needed. Previously confirmed appointment values and completed projects are preserved.

Customers can discuss scope with multiple responding professionals before choosing an estimate. Each discussion is participant-restricted; competitors cannot read each other's messages. An assessment is a discussion request, not a priced estimate or appointment booking. Pending estimates can be revised; acceptance must match the displayed revision. Non-selected discussions become read-only after booking. Calls require the configured Daily integration. Appointments change only after the other party confirms, and professionals request completion before customers mark work completed. The project page shows a stage guide and role-specific next steps.

Automated validation covers estimate revision conflicts, appointment self-confirmation and duplicate-response rejection, customer completion authority, outsider discussion access, closed discussions, and blocking. Live multi-account browser rendering, actual Daily calls, email delivery and signed native apps remain unverified. No deployment is claimed.

Remaining product work: preference-based category and geographic service-area matching, structured consultation appointments before hiring, quote history/withdrawal, chat media/read receipts, completion reminders, and in-progress cancellation negotiation. Saved drafts and administrator onboarding approval are implemented. Assessment discussions currently carry text; project attachments remain restricted to the customer and assigned professional. For the current release, every approved, subscribed, available professional can browse, chat about, call about, and estimate every open public project category. Pending completion stays in progress until the customer confirms or raises a support issue; there is no automatic completion.

## Mail-worker startup validation

The supplied Render logs confirmed both API pre-deploy and worker startup were blocked by the missing `STRIPE_PRO_PRICE_ID`. Worker startup now checks only database/SMTP configuration; API pre-deploy still requires the real professional subscription price. Unit tests cover independent worker startup, each missing required value, and invalid SMTP ports. Local tests do not verify Render deployment or Microsoft email delivery. The actual Stripe price must be supplied in the development backend environment group.

## Live in-app notifications

Migration 005 adds notification destinations and a PostgreSQL NOTIFY trigger. Notifications and email outbox entries are saved in the business transaction; rolled-back actions do not publish live events. Each API process holds one dedicated LISTEN connection and relays only an authenticated user's invalidation events over SSE. Streams rotate after 55 seconds to recheck revoked credentials and administrator TOTP policy. Browser tokens are passed in Authorization headers, never URL parameters. The current UI reconnects with backoff and retains its periodic workspace refresh. Initial connection reloads durable records, so events missed offline can be recovered. Read changes synchronize between tabs. There is a 10-connection per-user, per-process limit.

Coverage: account welcome; direct requests and all-category public opportunities; new/revised, accepted, declined and competing estimates; private project chats and messages; audio/video call invitations; appointment proposals/acceptance/decline; work start, completion requests/confirmation, cancellation and disputes; completed attachments; reviews/replies; Stripe identity/subscription state changes; profile suspension/restoration; support receipt/resolution and administrator case alerts. Subscription events notify only on stored-state changes; signed webhook event IDs retain duplicate protection. Private saved-pro and blocking choices intentionally do not alert the other person. New public-project alerts go to every approved, subscribed, available professional except blocked relationships until preference-based matching is implemented.

Tests cover commit/rollback delivery, destination storage, read-change events, recipient isolation, unsubscribe cleanup, SSE framing, and database listener integration using a mocked pg connection plus the real PGlite notification trigger. Real Render proxy streaming, reconnection across API replicas, browser interaction, Daily invitations, Microsoft delivery, and native background behavior still require deployed validation. This implements foreground in-app updates; it does not register service workers, browser push subscriptions, FCM/APNs device tokens, OS notification permission, or closed-app push.

Deploy the API with `npm run db:migrate` before releasing the new web/admin clients. No new environment variables or external realtime vendor is needed. Use the existing direct PostgreSQL connection for LISTEN (not a transaction-pooling proxy). Each API instance uses one additional database connection. The mail worker continues using the transactional email outbox and existing email-alert preference.

## Business profile branding and details

Migration 006 adds one logo, one cover and five portfolio slots per business, with separate ready/pending records so replacing a photo does not hide the existing one until the new image passes validation. Uploads require the profile owner and an existing saved professional profile. Only JPG/PNG/WebP up to 10 MB are accepted; completion checks R2 metadata and file header bytes (not a full decoder or malware scan). Pending reservations are reused per slot to avoid exhausting capacity on retries. Removing/replacing a published image removes its database reference; object cleanup failures are logged and may require R2 cleanup. Previously issued image links can remain usable until their ten-minute expiry if object deletion fails.

Owner previews use temporary signed R2 URLs. Public image redirects enforce identity verification, non-suspension and active/trialing membership. Bucket keys/credentials are omitted from profile JSON. Public profile rendering is server-side; the directory displays uploaded logos/covers. Details are grouped into introduction, team, contact/location, services/coverage, hours/policies and self-reported credentials. Preview toggling keeps unsaved form fields mounted. Images save independently of business text fields.

Tests validate formats, file signatures, slot constraints, preservation of ready images during replacement, lack of object-key leakage, customer write rejection and suspended-profile image access. Live R2 upload/CORS, browser visual behavior and native file-picker behavior remain unverified. Deploy `npm run db:migrate` before serving the updated API. Existing R2 configuration is reused; no new environment variable is needed. No sample business photos or marketplace accounts are seeded.

## Project workflow review fixes

This release follows a code review of the post-project → quote → award → work flow. Migration `010_award_handshake_and_expiry.sql` is required (see the second list below); no environment variable changes.

- Matching professionals can now see a customer's ready image attachments (not PDFs, address or contact details) on open projects before quoting, and can request signed links only while the project is open and they match it or hold a pending estimate. This supersedes the earlier note that attachments are limited to the customer and assigned professional.
- Reviewer notes, submission/review timestamps and Connect readiness are removed from public professional listings and from other users' workspaces; only the profile owner and administrators receive them.
- Customers can decline expired estimates (acceptance still requires an unexpired estimate). Accepting re-checks the professional's subscription and blocking, and keeps withdrawn estimates as withdrawn. Professionals who lose a project keep their estimate history and are told their estimate was not selected.
- A directly requested professional can no longer pause, cancel or delete the customer's request before an estimate is accepted. A new `open_request` action lets the customer release such a request to every matching professional.
- Match alerts skip professionals who already quoted or were alerted with the same title in the last 12 hours, so repeated pause/resume cannot re-spam them. Past appointment or expiry times now return 400 instead of 500.
- Client: the new-project form keeps typed values when returning from the review step, upload progress and retry are visible while reviewing, accept requires confirmation and is hidden for expired estimates or non-open projects, estimate/quote forms are gated on an approved available profile, lifecycle toasts describe the real outcome, and cancelled/disputed projects no longer show a blank progress tracker.

Second pass (award handshake, expiry, delivery, ranking):

- Accepting an estimate now only _selects_ the professional (`projects.award_accepted=false`). Work cannot start until that professional sends `accept_award`; they can instead `decline_award` (reason shown to the customer) and the request returns to the open market, and the customer can `withdraw_award`. Competing estimates stay pending ("on hold") until the award is confirmed, and losing professionals are notified only then. Existing booked projects migrate as already confirmed. A declined or withdrawn award returns the project to the open market even if it began as a direct request.
- The background worker now expires lapsed pending estimates on open projects (status `expired`, revision bumped, project version bumped, professional and customer notified, activity recorded). Expired estimates can be re-sent. Boundary: the job runs only while the worker service is running; it was exercised against the PGlite fixture, not a deployed worker.
- Email delivery claims up to 20 messages with a five-minute lease, sends outside the database transaction and drains the queue before sleeping, so a failed commit cannot cause duplicate sends and throughput is no longer one message per three seconds. A crash mid-send can still repeat that one message after the lease lapses. Provider delivery was not exercised; tests use a fake sender.
- Matching alerts and customer notifications use bulk inserts; new-project alerts go to the best-ranked 50 matching professionals (Bayesian-weighted rating, then distance, then id). The same ranking orders the customer's five-card shortlist.
- A professional cannot quote, be accepted by, or be reviewed by an account whose email is the same after removing plus-tags and Gmail dots, and a customer can review a given professional once every 30 days. This is a heuristic against self-dealing, not identity verification; it does not detect different emails or addresses.
- A `charge.refunded` webhook that closes a disputed project now bumps its version and notifies both participants (no activity entry, because the event has no human actor).

Automated tests cover each server rule against the in-memory PostgreSQL fixture. Browser rendering of the new confirm/decline panel, real signed-photo downloads, live notification delivery, and a deployed worker were not exercised. Migration 010 has not been run against a Render database.

Third pass (project action bar):

- Every project page now opens with a role- and state-aware action bar: customers get Find professionals, Compare estimates, Messages, Propose a time and Edit details while a request is open; Message, Audio/Video call, Propose a time, Add to calendar and Save professional once a professional is assigned; and Leave a review, Save professional and Hire again after completion. Professionals get Message customer and Send/Update estimate on open leads, and Message, calls, Propose a time, Add to calendar and Directions once assigned. Get help is always present. Buttons that jump to a section (chat, estimates, estimate form) scroll and focus the first field.
- Each estimate card gives the customer Chat with this pro, View profile and a Save heart. Saving stays blocked for unverified professionals. The chat composer gains "Suggest a time", which sends a chat message; only the project proposal flow changes the confirmed appointment.
- New server action `update_details` (customer only, while the request is requested/quoted): title, description, timing and budget. It bumps the project version, records activity, and notifies professionals with a pending estimate or a conversation. Address and category are intentionally not editable.
- Calendar export is a client-generated `.ics` file; directions open a Google Maps URL. Both are covered by unit tests of the generated text only. Browser rendering, the file download on iOS/Android WebViews, and scroll/focus behaviour were not exercised.

## R2 image delivery, in-app professional profiles and saved pros

This release fixes image upload/retrieval and reworks how customers reach professional profiles. No migration and no environment variable changes are required; deploy the API and web client together.

- Presigned R2 URLs no longer embed the AWS SDK's default flexible checksums. Newer `@aws-sdk/client-s3` releases signed an empty-body CRC32 into every presigned PUT (and `x-amz-checksum-mode` into GETs), which R2 rejects, so browser uploads failed and completed images could not be fetched. The S3 client now uses `requestChecksumCalculation`/`responseChecksumValidation: "WHEN_REQUIRED"`. Verified locally: generated URLs contain no checksum parameters and sign only `content-length;host`.
- The API now sends `Cross-Origin-Resource-Policy: cross-origin` (helmet previously defaulted to `same-origin`), so browsers on the customer origin can embed `/api/business-images/:id` responses as images. The public image route's eligibility rules (verified, approved, unsuspended, subscribed) are unchanged.
- Authenticated workspace responses now give every viewer short-lived signed image URLs for the profiles they are already authorized to see (project/discussion/estimate/saved professionals and administrators), instead of public redirect links that 404 for unapproved or unsubscribed businesses. Signed image URLs are cached server-side for most of their ten-minute validity so workspace polling reuses the same URL instead of re-signing every ten seconds.
- `GET /uploads/:id` returns an inline-disposition signed link for image attachments (documents keep the attachment disposition), and project pages render ready image attachments and customer photos as thumbnails that fetch a fresh link when opened.
- Customers get an in-app professional profile page (`pro` route) rendering the shared business display with Save and Chat actions; the Directory, Saved pros and estimate cards link to it instead of the server-rendered `/professionals/:id` page (which remains for public SEO and still requires full eligibility). This also works in the native apps, where the old absolute link never left the hash router.
- Saving a professional no longer requires verification: any non-suspended saved profile can be hearted and stays visible on the Saved page (blocked professionals excluded), so customers can always unsave. The API returns 404 when the profile does not exist or is suspended instead of silently succeeding, and the client shows accurate save/unsave confirmations. Professionals who sent estimates on a customer's projects are now always included in the customer's workspace profiles.
- The business profile editor is restructured into four steps (Business details, Photos & logo, Verification & review, Profile preview) with per-step completion indicators; all fields, validation and endpoints are unchanged.

Automated tests pass against the PGlite fixture (workspace tests now run with fixture R2 credentials since every workspace response presigns image URLs). Live R2 upload/download against a real bucket, bucket CORS, browser rendering of the new profile page and thumbnails, and native builds were not exercised here and still need development-environment validation.

## Listed businesses stay live during re-review; favorites coverage

Migration `011_listed_profiles.sql` is required (run `npm run db:migrate` before deploying this API). It adds `profiles.listed`, backfilled from currently approved profiles. No environment variable changes.

- Approving a review sets `listed`; rejecting or requesting changes clears it. Every eligibility check (public pages, discovery/matching, chat, estimates, estimate acceptance, the public image route) now accepts `review_status='approved' OR listed`.
- Saving business details only resets the review when customer-facing content actually changed (name, category, bio, rate, address, details are compared with a key-order-stable serializer). Availability, schedule and service-radius edits never touch review state, and an unchanged re-save no longer un-approves a profile.
- When a listed business changes material content or photos, the profile auto-resubmits (`pending`, administrators notified) but the listing stays publicly visible with the new content until an administrator approves, requests changes, or rejects. This is deliberate post-moderation for already-approved businesses: unreviewed edits of a listed profile are public until actioned. First-time and previously declined submissions still fail closed (draft, not public). The administrator console flags pending profiles that are currently listed.
- Upload failures in the browser now include the storage HTTP status in the error message.
- New tests cover: saved draft/unverified professionals staying visible to the customer (so they can always be unsaved), blocked professionals excluded from the saved list, estimate senders included in the customer workspace, the suspended-profile save refusal predicate, and listed-while-pending public visibility including delisting on changes requested. The `POST /saved/:id` HTTP 404 path and the full `PUT /profile` route (it calls Google address lookup) are exercised only at the SQL-predicate level, not over HTTP.

Boundary: PGlite tests only; migration 011 has not been run against a Render database, and the admin review flow for a live-listed edit was not exercised in a browser.


## Separate Stripe webhook destinations (2026-10-06)

Added `/api/webhooks/stripe-subscriptions` and `/api/webhooks/stripe-identity`, each requiring its own backend-only signing secret and rejecting other event families before recording an event. The existing combined and historical Connect routes remain intact for migration. Deployment validation accepts either the existing combined secret or both dedicated secrets. No client/native dependency or database migration changes.

`npm run check` passed: TypeScript validation, all 88 tests, customer client/SSR build and admin build. Database integration coverage uses real Stripe SDK signatures to reject missing/wrong secrets, prevent cross-family processing, require a dedicated secret even when the legacy secret is configured, and deduplicate retries. Subscription current-state and owned Identity lifecycle tests now exercise their dedicated routes. Legacy signature/idempotency coverage remains. No external Stripe destinations have been created by this task; no Render deployment or live webhook deliveries have been verified. New routes are local changes on development pending commit/push/deployment.


## Three membership billing periods (2026-10-06)

Implemented backend-only `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_SIX_MONTH_PRICE_ID`, and `STRIPE_PRO_YEARLY_PRICE_ID` for USD $40/month, $210/every six months and $360/year. Full distinct configuration is required once any new price variable is set; no legacy price is required for new enrollment with all three present. The optional legacy variable keeps old enrollments recognized and supplies a single-plan fallback when all three are absent. No database migration is required.

The API retrieves actual Stripe prices, validates currency/amount/interval/mode/active/licensed usage, and maps only a server-approved plan key into checkout. Same-plan open sessions resume; switching expires the previous session; a completed or concurrently completing checkout does not start another. Creation idempotency includes price and URLs. Webhooks validate one recognized item with quantity one, maintain stored customer ownership and current-state reconciliation, and remain the only authority granting membership. The client shows full upfront charges, renewal terms, accurate 12.5%/25% savings, current plan and billing-period end; Stripe catalog failures leave existing billing management available. No private Stripe configuration is exposed by the public config or plan response.

`npm run check` passed with all 92 tests, including HTTP/PGlite three-plan selection, tampered amount/Price ID rejection by server selection, customer/unverified enrollment rejection, session reuse/switch/expiry conflict/transport retry, signed activation for every plan, wrong-price rejection, and catalog-failure management availability. After the final display-only savings correction, the three membership tests, TypeScript and customer client/SSR/admin builds passed again. `npx cap sync` succeeded for Android/iOS/web; CocoaPods and Xcode checks remain unavailable on Windows. The cards were visually reviewed using an isolated local preview at 1200px and 390px viewport widths with no horizontal overflow. This preview did not create accounts or initiate checkout. Authenticated browser checkout, actual Stripe Price IDs, live/test Stripe webhook deliveries, Render deployment, and signed native builds remain unverified.

## Professional identity and membership journey (2026-10-07)

Connected profile, Identity, membership and marketplace review with a shared accessible setup navigation. The review link opens `/app/profile/setup` directly. Verified professionals continue from Identity to membership; Identity and subscription pages refresh on workspace live invalidations as well as focus/polling. Membership now has loading, active, scheduled cancellation, ended and payment-attention presentations, a manual refresh, explicit prerequisites and a billing help panel. Existing subscription problems direct professionals to the portal rather than another subscription. Enrollment cards display only when starting or rejoining. Return query parameters provide explanatory messages and never grant identity or membership.

Checkout cancellation and Customer Portal returns now include `checkout=canceled` and `checkout=portal`; success retains `checkout=processing`. No new environment variables or migration. Deploy the API and customer web together; existing open Stripe sessions may still return to the plain subscription page, which continues to work.

`npm run check` passed with all 96 tests, TypeScript and customer client/SSR/admin builds. New coverage verifies that checkout return hints cannot assert activation for unconfirmed/problem states, that payment problems direct existing subscribers to billing, that loading/cancellation/attention states remain distinct, and that setup progress does not fabricate approvals. The database/Stripe mock integration test asserts the success/cancellation URLs. The final enrollment-display refinement passed TypeScript and all builds again. An isolated browser preview of the real setup, summary and pricing components at 1280px and 390px had no horizontal overflow; the payment-attention summary was also visually checked. This preview had no account data, authentication bypass or payment actions. Authenticated browser navigation, real Stripe sandbox payment/Identity sessions, webhook delivery, Render deployment and signed native builds remain unverified.

`npx cap sync` completed for Android, iOS and web after the final build. CocoaPods and Xcode are unavailable on this Windows host; asset synchronization is not evidence of a signed native build or successful native Stripe return.
