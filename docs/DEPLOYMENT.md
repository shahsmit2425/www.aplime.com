# Deployment and promotion

## Branch policy

Always start work on `development` (or a feature branch created from it and merged back into it). Promote with a PR from `development` to `stagging`, then from `stagging` to `main`. The CI promotion check rejects other PR sources into the latter two branches.

A development push only selects the development GitHub environment and its Render service IDs. No workflow merges, force-pushes, or deploys a second environment automatically. Code changes reach all three only when deliberately promoted. This gives staging a useful review step and preserves production stability.

Require the `Validate` check on promotion branches, disallow force pushes/deletions, and require pull requests. GitHub plan/permissions determine whether repository branch protections can be enabled. Configure these repository settings if they are not already applied. A workflow by itself cannot stop an administrator from bypassing repository controls.

## Separate services in each environment

| Service | Render type | Build | Start / publish |
| --- | --- | --- | --- |
| Customer/pro website | Web Service, Node | npm ci --include=dev && npm run build:web | npm run start:web |
| Admin website | Static Site | npm ci --include=dev && npm run build:admin | dist/admin |
| Backend API | Web Service, Node | npm ci --include=dev | npm run start:api |
| PostgreSQL | Managed PostgreSQL | — | — |
| Mail delivery | Background Worker, Node | npm ci --include=dev | npm run worker |

All repository root-directory fields stay blank. Select the environment's branch on **every service**. Set Auto-Deploy to **Off**; GitHub Actions owns deployment. The API pre-deploy command is `npm run config:check && npm run db:migrate`. Health paths are `/api/health` for API and `/health` for web. Admin publishes a nonsecret `/release.json` for deployment verification.

## First-time development setup

1. Create the development PostgreSQL database and the three application services plus mail worker above. Keep Node services/database in the same region. Alternatively apply `render.yaml` as a Blueprint; it creates **all three environments with paid web/API/worker/database plans**, so review its cost summary first.
2. Record the assigned customer, API and admin HTTPS domains. The examples dev.yourdomain.com, api-dev.yourdomain.com and admin-dev.yourdomain.com are placeholders, not provisioned domains.
3. Create `servicetones-development-common` for all four application services and `servicetones-development-backend` for API/worker only. Enter provider credentials and the internal DATABASE_URL in backend; set DATABASE_SSL=render-internal there. PostgreSQL itself does not use an application group.
4. In common set NODE_ENV=production, APP_ENV=development, NODE_VERSION=22.16.0, SITE_URL and API_URL. Keep all other application values in backend. Remove conflicting service-level overrides and duplicate keys between groups.
5. The admin build derives its public API URL and environment from API_URL and APP_ENV in common. Do not create duplicate VITE variables. For manual static setup, copy the security headers and fallback rewrite from render.yaml; the build output is dist/admin.
6. Add customer/admin origins to API ALLOWED_ORIGINS and Firebase authorized domains. Keep capacitor://localhost and https://localhost for mobile. Stripe webhook destinations use the **API domain**; return links use the customer SITE_URL.
7. Populate the development GitHub Environment below, then manually run the release workflow on development. A manual run deploys all components; normal pushes select only affected components. Deployments occur API → worker → web → admin when selected. Each selected service must report the exact deployed SHA and environment (worker has no HTTP endpoint).
8. Provision your administrator using [ADMIN_SECURITY.md](ADMIN_SECURITY.md). Enable Firebase Identity Platform TOTP, approve the UID, provision its database role/custom claim, enroll MFA and sign in again. No administrator exists by default.
9. Test the development flows before promoting code to stagging and main. Repeat setup with isolated credentials and separate resources for each environment.

If you already created the old combined service, reuse it as the **API** only after changing its start/build commands. Create the separate web/admin services, move customer SITE_URL to the new web domain, update native API_URL/Firebase/Stripe/CORS settings and GitHub service IDs, then redeploy. Link common to all application services, backend to API/worker only, unlink the old single group, remove obsolete service-level values and rebuild the frontends. Existing real database data is retained; no schema reset is part of this refactor.

## GitHub configuration and selective deployment

Each GitHub Environment (development, stagging, production) needs these variables:

| Name | Value |
| --- | --- |
| SITE_URL | Customer website HTTPS origin |
| API_URL | Backend HTTPS origin, without /api |
| ADMIN_URL | Admin static site's HTTPS origin |
| RENDER_WEB_SERVICE_ID | Customer web service ID |
| RENDER_API_SERVICE_ID | Backend API service ID |
| RENDER_ADMIN_SERVICE_ID | Admin static site ID |
| RENDER_WORKER_SERVICE_ID | Mail worker ID |
| MOBILE_RELEASES_ENABLED | true after signing and store setup |
| BACKEND_RELEASES_ENABLED | true only after the API/worker backend group is complete; leave false for website-only preview |

Store RENDER_API_KEY as a secret. RENDER_SERVICE_ID from the old combined setup is no longer used.

`apps/admin/**` changes deploy admin only. `src/client/**` changes deploy customer web and mobile. Backend changes deploy API; shared worker dependencies deploy worker too. Shared contracts/dependencies/configuration fan out to affected apps. Documentation-only pushes deploy nothing. Validation still tests/builds all apps.

Push selection compares the complete push range (including promotion merge commits). If a component deployment fails, rerun that failed workflow before advancing it; a later unrelated push intentionally does not deploy the failed component. Workflow dispatch provides a full redeploy/recovery path. Keep backend contracts compatible with independently released websites and already-installed mobile versions. Use additive migrations first, then retire old contracts only after clients migrate.

The following **GitHub secrets** are also required for native releases. They cannot be replaced by Render runtime variables because Xcode and Android signing run on GitHub runners.

| Secret | Purpose |
| --- | --- |
| GOOGLE_SERVICES_JSON_BASE64 | Base64 of the environment's Android Firebase config |
| GOOGLE_SERVICE_INFO_PLIST_BASE64 | Base64 of the environment's iOS Firebase config |
| ANDROID_KEYSTORE_BASE64 | Base64 of the Android upload keystore |
| ANDROID_KEYSTORE_PASSWORD | Keystore password |
| ANDROID_KEY_ALIAS | Upload key alias |
| ANDROID_KEY_PASSWORD | Upload key password |
| GOOGLE_PLAY_SERVICE_ACCOUNT_JSON | Raw Google Play API service-account JSON |
| APPLE_TEAM_ID | Apple Developer team ID |
| ASC_KEY_ID | App Store Connect API key ID |
| ASC_ISSUER_ID | App Store Connect API issuer |
| ASC_KEY_BASE64 | Base64 of the App Store Connect .p8 private key |
| IOS_CERTIFICATE_BASE64 | Base64 of the Apple Distribution .p12 certificate |
| IOS_CERTIFICATE_PASSWORD | .p12 password |
| IOS_PROFILE_BASE64 | Base64 of an App Store distribution provisioning profile |
| IOS_PROFILE_NAME | Exact provisioning-profile name |
| KEYCHAIN_PASSWORD | Random password for the ephemeral CI signing keychain |

Use separate app records and Firebase native applications for:
- `com.servicetones.app.dev`
- `com.servicetones.app.staging`
- `com.servicetones.app`

The Firebase files must match the selected application's package/bundle ID and Firebase project. The mobile preparation script validates those relationships. Enable Google and Apple sign-in, register the Android certificate fingerprints, and enable the iOS Sign In with Apple capability on the provisioning profiles.

Google Play typically requires first-time console/app setup before API uploads. Create each app listing, configure Play App Signing, grant the service account release access, and finish the initial upload/required forms in Play Console. Android testing uploads use internal testing; production uploads are **drafts**, awaiting your release review.

Create matching iOS App Store Connect records and internal TestFlight tester groups. TestFlight uploads do not automatically add testers or bypass processing, export-compliance questions, or external-beta review. Production iOS builds also go to TestFlight before App Store submission.

## Cloudflare domains

Suggested names are `dev.yourdomain.com`, `staging.yourdomain.com`, and your production domain. Add each custom domain in the matching Render web service, then create its DNS record in Cloudflare using the exact target Render supplies. Complete certificate validation, use Full (strict) TLS, and avoid caching API responses or authenticated pages. Never cache responses containing user data.

Update `SITE_URL`, `ALLOWED_ORIGINS`, Firebase authorized domains, Stripe webhook endpoints and GitHub environment SITE_URL/API_URL/ADMIN_URL. Rebuild native apps if their API URL changes. The repository does not require a Cloudflare global API key for DNS; R2 uses a separate bucket-scoped credential.

## Configuration changes and rollback

Web runtime config changes take effect after redeployment. Mobile public config is bundled at build time, so changes to the endpoint/Firebase public config need a new build. Do not solve a configuration change with branch-specific edits.

Use a reviewed revert on `development`, then promote it. For urgent rollback, Render can redeploy a previously good commit, but keep database migrations backward-compatible. Never automatically reverse a migration or restore a production database from development data.

## Current release boundary

The workflow and source are configured; external accounts, service URLs, credentials and signing files must be supplied before a deployment can complete. No Render domain, signed IPA/AAB, TestFlight upload or Play release is claimed merely because code was pushed.

## Configuration changes

Changing common values can affect all applications. Changing backend credentials only requires applying them to API/worker. Keep auto-deploy off; manually redeploy/rebuild affected services after environment edits, or use full workflow dispatch for all. Frontend build/runtime processes must not receive the backend group. Public output remains explicitly allowlisted.
