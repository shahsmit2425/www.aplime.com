# Validation and launch status

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

Remaining product work: geographic service-area matching, structured consultation appointments before hiring, saved drafts, admin onboarding approval, quote history/expiry/withdrawal, chat media/read receipts, completion reminders, and in-progress cancellation negotiation. Assessment discussions currently carry text; project attachments remain restricted to the customer and assigned professional. Matching remains service-category based. Pending completion stays in progress until the customer confirms or raises a support issue; there is no automatic completion.


## Mail-worker startup validation

The supplied Render logs confirmed both API pre-deploy and worker startup were blocked by the missing `STRIPE_PRO_PRICE_ID`. Worker startup now checks only database/SMTP configuration; API pre-deploy still requires the real professional subscription price. Unit tests cover independent worker startup, each missing required value, and invalid SMTP ports. Local tests do not verify Render deployment or Microsoft email delivery. The actual Stripe price must be supplied in the development backend environment group.


## Live in-app notifications

Migration 005 adds notification destinations and a PostgreSQL NOTIFY trigger. Notifications and email outbox entries are saved in the business transaction; rolled-back actions do not publish live events. Each API process holds one dedicated LISTEN connection and relays only an authenticated user's invalidation events over SSE. Streams rotate after 55 seconds to recheck revoked credentials and administrator TOTP policy. Browser tokens are passed in Authorization headers, never URL parameters. The current UI reconnects with backoff and retains its periodic workspace refresh. Initial connection reloads durable records, so events missed offline can be recovered. Read changes synchronize between tabs. There is a 10-connection per-user, per-process limit.

Coverage: account welcome; direct requests and service-category opportunities; new/revised, accepted, declined and competing estimates; assessment discussions and messages; call invitations; appointment proposals/acceptance/decline; work start, completion requests/confirmation, cancellation and disputes; completed attachments; reviews/replies; Stripe identity/subscription state changes; profile suspension/restoration; support receipt/resolution and administrator case alerts. Subscription events notify only on stored-state changes; signed webhook event IDs retain duplicate protection. Private saved-pro and blocking choices intentionally do not alert the other person. New lead alerts follow existing category eligibility, not geographic matching.

Tests cover commit/rollback delivery, destination storage, read-change events, recipient isolation, unsubscribe cleanup, SSE framing, and database listener integration using a mocked pg connection plus the real PGlite notification trigger. Real Render proxy streaming, reconnection across API replicas, browser interaction, Daily invitations, Microsoft delivery, and native background behavior still require deployed validation. This implements foreground in-app updates; it does not register service workers, browser push subscriptions, FCM/APNs device tokens, OS notification permission, or closed-app push.

Deploy the API with `npm run db:migrate` before releasing the new web/admin clients. No new environment variables or external realtime vendor is needed. Use the existing direct PostgreSQL connection for LISTEN (not a transaction-pooling proxy). Each API instance uses one additional database connection. The mail worker continues using the transactional email outbox and existing email-alert preference.
