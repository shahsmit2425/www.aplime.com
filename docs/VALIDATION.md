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
