# Complete environment-variable reference

The website brand is Aplime and its domain is `aplime.com`. Set `SITE_URL` to the actual customer origin for each environment (for example `https://aplime.com` if that is the domain attached to your development web service). Set `API_URL` to the actual API origin; do not assume API/admin subdomains exist. Match these values in GitHub's environment variables, and include the customer and admin origins in backend `ALLOWED_ORIGINS`. Update Firebase authorized domains and R2 CORS when changing domains.

For website-only testing, leave GitHub `MOBILE_RELEASES_ENABLED` unset or set it to `false`. Render deployment and validation still run; iOS/Android publishing is skipped. Set it to `true` after both platforms' store/signing setup is complete. Native build validation remains enabled.

## Where values live

Use two Render groups per environment. Replace development with stagging or production for the other environments.

| Group | Linked services | Variables |
| --- | --- | --- |
| servicetones-development-common | Customer web, admin static site, API, mail worker | NODE_ENV, NODE_VERSION, APP_ENV, SITE_URL, API_URL |
| servicetones-development-backend | API and mail worker only | Every other application variable below, including DATABASE_URL, ADMIN_ALLOWED_UIDS and provider credentials |

The Blueprint creates six groups and links them to the correct services. It supplies non-secret defaults only. Add SITE_URL/API_URL manually to common. After creating the database, copy its internal URL into backend DATABASE_URL. PostgreSQL itself does not consume an application group. Do not duplicate variable names between groups or leave conflicting service-level overrides.

Common development values:

```dotenv
NODE_ENV=production
NODE_VERSION=22.16.0
APP_ENV=development
SITE_URL=https://<customer-domain>
API_URL=https://<api-domain>
```

Put ALLOWED_ORIGINS, SUPPORT_EMAIL, DATABASE_URL, DATABASE_SSL, optional DATABASE_CA_CERT, all FIREBASE_* values, ADMIN_ALLOWED_UIDS, UPSTASH_*, STRIPE_*, DAILY_API_KEY, R2_*, GOOGLE_MAPS_SERVER_KEY, SMTP_*, MICROSOFT_*, SENTRY_DSN and PUBLIC_SENTRY_DSN in backend. Some of these are non-secret, but only the backend consumes them directly. Its public-config allowlist intentionally returns the Firebase web configuration, public Sentry DSN and support email to clients.

Admin builds derive their public settings from common API_URL and APP_ENV; do not add duplicate VITE variables. Both frontend build configurations disable automatic prefixed-variable exposure. Private values must never appear in browser bundles or public configuration.

Leave ADMIN_ALLOWED_UIDS empty until provisioning; this disables admin API access. Follow [ADMIN_SECURITY.md](ADMIN_SECURITY.md). ALLOWED_ORIGINS includes customer/admin origins plus capacitor://localhost and https://localhost.

Keep Auto-Deploy off. Apply configuration changes by redeploying the services that use the changed values; rebuild admin/mobile when their bundled public configuration changes. A full workflow dispatch is available if all services need refreshing. Code-only pushes still use selective deployment. GitHub signing/deployment secrets remain in GitHub Environments.

If migrating from the previous single group: create/populate both new groups first; link common to all application services and backend to API/worker; unlink the old group from every service; remove duplicate service-level variables; then redeploy/rebuild. Renaming an old secret-bearing group to common is not sufficient—remove its credentials first. Rebuild both frontends so their running/build configuration no longer includes the old group. Existing database records are unchanged.

## Core and database

| Variable | Required / default | Value or source |
| --- | --- | --- |
| NODE_ENV | Render: `production`; local: `development` | Controls optimized server execution, independent of APP_ENV |
| APP_ENV | Required | `development`, `stagging`, or `production` |
| NODE_VERSION | Blueprint sets `22.16.0` | Render build/runtime Node version; maintain within Node 22 |
| PORT | Render supplies; local defaults to `5173` | HTTP listening port |
| SITE_URL | Required HTTPS on Render | Exact canonical website URL, no trailing slash |
| ALLOWED_ORIGINS | Required for your domain setup | Comma-separated site origin plus `capacitor://localhost,https://localhost`; local origins only in development |
| DATABASE_URL | Required; enter in backend group | Matching Render Postgres **internal** connection string. Never expose publicly |
| DATABASE_SSL | Blueprint: `render-internal`; default: `require` | `require` validates certificates; `render-internal` encrypts to Render's private dpg host with its self-signed certificate; `disable` only for local Postgres |
| DATABASE_CA_CERT | Optional | PEM CA for certificate-validated external Postgres connections |
| RENDER_GIT_COMMIT | Render automatically supplies | Deployed commit ID; used to match web/mobile releases |
| RENDER | Render automatically supplies | The private-host TLS policy requires `true`; do not set this locally to bypass checks |
| SUPPORT_EMAIL | Required | Your actual support mailbox |

The Blueprint disables external database access. Internal TLS uses Render's documented self-signed-certificate behavior; the special mode is rejected outside Render or for an unrelated hostname. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Firebase and Google/Apple authentication

Use a **separate Firebase project per environment**. Enable Email/Password, Google, and Apple in Firebase Authentication.

| Variable | Visibility | Value or source |
| --- | --- | --- |
| FIREBASE_PROJECT_ID | Public project identifier | Firebase project ID |
| FIREBASE_CLIENT_EMAIL | Server only | Service-account client_email |
| FIREBASE_PRIVATE_KEY | Secret | Service-account private_key PEM; literal `\\n` is accepted and converted to newlines |
| FIREBASE_WEB_API_KEY | Public, restricted | Firebase web app apiKey; restrict API usage appropriately |
| FIREBASE_AUTH_DOMAIN | Public | Firebase authDomain; authorize your website domain in Firebase |
| FIREBASE_APP_ID | Public | Firebase web app appId |
| FIREBASE_MESSAGING_SENDER_ID | Public, optional for current auth | Firebase messagingSenderId |

A Firebase web API key identifies the project; it is not an Admin service-account secret. The public config endpoint exposes only the web fields, never `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL`.

Google OAuth web client configuration is managed in Firebase/Google Cloud. Android signing fingerprints and iOS reversed-client-ID URL schemes are needed for native sign-in. Native Firebase config files belong in GitHub environment secrets, described below.

## Upstash Redis

| Variable | Required | Value or source |
| --- | --- | --- |
| UPSTASH_REDIS_REST_URL | Yes on Render | Upstash database REST endpoint |
| UPSTASH_REDIS_REST_TOKEN | Yes, secret | Upstash REST token |

Use a distinct database per environment. Rate-limit keys are additionally prefixed by APP_ENV. Local development can omit Redis; deployed environments fail config validation if it is missing.

## Stripe payments, payouts and document verification

| Variable | Required | Value or source |
| --- | --- | --- |
| STRIPE_SECRET_KEY | Yes, secret | `sk_test_...` in development/stagging; `sk_live_...` in production |
| STRIPE_WEBHOOK_SECRET | Yes, secret | Signing secret for this environment's `/api/webhooks/stripe` endpoint |
| STRIPE_CONNECT_WEBHOOK_SECRET | Yes, secret | Signing secret for the connected-account `/api/webhooks/stripe-connect` endpoint |
| STRIPE_PLATFORM_FEE_PERCENT | Default `10` | Platform fee, 0–30; confirm your business pricing before live payments |

Checkout is Stripe-hosted, so there is no browser publishable key in this implementation. Enable Stripe Identity and Connect in the account. Identity and Connect serve different purposes; both are required for professional onboarding.

Register `identity.verification_session.verified`, `identity.verification_session.requires_input`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded` at `/api/webhooks/stripe`. Configure a separate connected-account destination for `account.updated` at `/api/webhooks/stripe-connect`, with its own `STRIPE_CONNECT_WEBHOOK_SECRET`.

## Daily calls

| Variable | Required | Value or source |
| --- | --- | --- |
| DAILY_API_KEY | Yes, secret | Daily account REST API key |

“Saily.io” was interpreted as Daily.co / Daily calling. The implementation uses the official `api.daily.co` REST API. Use distinct Daily domains/accounts for isolation where available. No Daily API key is shipped to clients; only short-lived, room-scoped participant tokens.

## Cloudflare R2 file storage

| Variable | Required | Value or source |
| --- | --- | --- |
| R2_ACCOUNT_ID | Yes | Cloudflare account ID |
| R2_ACCESS_KEY_ID | Yes, secret | Bucket-scoped R2 S3 access key |
| R2_SECRET_ACCESS_KEY | Yes, secret | Matching R2 secret key |
| R2_BUCKET | Yes | Private bucket for this environment |

Create three private buckets. Grant the credential access only to its intended bucket. Configure bucket CORS for the website and native origins; allow PUT/GET/HEAD and Content-Type. The app generates signed upload/download URLs. Do not set a public bucket URL or use a Cloudflare global API key.

Cloudflare DNS/custom-domain management needs no application environment variable when configured in its dashboard.

## Google Maps

If autocomplete returns a generic service error on an older deployment, do not replace the server key with a browser key or remove address validation. After deploying the address-diagnostics update, run `npm run maps:check` in the **API service's Render Shell**. This uses that service's actual configuration and reports only a safe error code and allowlisted Google reason; it never prints the credential or submitted address. It makes one billable Places autocomplete request and does not change application data.

1. Confirm `GOOGLE_MAPS_SERVER_KEY` is set in the backend group linked to the API service, with no empty or outdated service-level override. Save and redeploy the API after changing it.
2. In the Google Cloud project that owns the key, enable billing and **Places API (New)**. Enabling Maps JavaScript API or the legacy Places API alone does not enable this endpoint.
3. Edit the server key's API restrictions to allow **Places API (New)** (and Geocoding for legacy ZIP lookup). Application restrictions must permit Render's backend outbound IPs, not HTTP referrers. Keep your separate browser key restricted to browser use.
4. Interpret API logs: `ADDRESS_CONFIGURATION_ERROR` with `SERVICE_DISABLED` means enable Places New; `BILLING_DISABLED` means fix project billing; `API_KEY_INVALID` means correct the credential; `API_KEY_SERVICE_BLOCKED`, `API_KEY_IP_ADDRESS_BLOCKED`, or `API_KEY_HTTP_REFERRER_BLOCKED` means fix the corresponding key restriction. `ADDRESS_RATE_LIMITED` means check quota; `ADDRESS_TIMEOUT` means retry/check provider connectivity. If the reason is absent, inspect the key/project settings against the upstream HTTP status. Raw Google messages are deliberately not exposed.
5. Confirm the diagnostic succeeds, then test a real US street address in a signed-in project/business form. Random text can correctly return no suggestions. A direct address-bar request without the app's bearer token will be rejected. The diagnostic only checks Google; it does not verify authentication, Redis, or database middleware.

## Temporary marketplace discovery

| Variable | Required / default | Value or source |
| --- | --- | --- |
| MARKETPLACE_DISCOVERY_MODE | Optional; `open` | Backend group only. `open` enables browsing across categories/locations. Set `matched` to restore five customer matches per project and preference-based pro discovery. Redeploy the API after changing it. |

This release defaults to `open`, so no new Render variable is required to broaden browsing. Customers can browse eligible businesses without first posting a project; a project is still required to start a private conversation. Professionals can browse the latest 100 unassigned requested/quoted projects. Profile responses remain bounded at 500. Verified identity, administrator approval, availability, active/trialing subscription, blocking rules, private-address protection, and lifecycle authorization remain enforced. Existing business relationships remain accessible for management even when they are no longer discoverable. New-project notifications continue to target service/location matches in both modes, rather than notifying every professional nationwide.

## Google Maps key reference

| Variable               | Required    | Value or source                                                                                                                                                                                                                                                            |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GOOGLE_MAPS_SERVER_KEY | Yes, secret | Server-side Google Maps key with billing, Places API (New), and Geocoding API enabled. Used for authenticated address suggestions, canonical street-address validation and legacy ZIP lookup. Keep in the backend group only; never expose it in a frontend/mobile bundle. |

In the Google Cloud project that owns this key, enable billing and **Places API (New)** as well as **Geocoding API**. Allow both APIs in the key's API restrictions and, where possible, restrict it to Render's outbound IP addresses. Do not use browser-referrer restrictions for this server key. Both the project and business forms now require selecting a full US street address; the server resolves the selected place again before saving. Legacy ZIP lookup still uses Geocoding. No browser Maps key or new Render variable is needed. See Google's [Places API (New) setup](https://developers.google.com/maps/documentation/places/web-service/cloud-setup).

## Microsoft 365 SMTP alerts

| Variable | Required / default | Value or source |
| --- | --- | --- |
| SMTP_HOST | `smtp.office365.com` | Microsoft 365 SMTP endpoint |
| SMTP_PORT | `587` | STARTTLS port |
| SMTP_USER | Yes | Licensed/authorized sending mailbox |
| SMTP_FROM | Yes | Sender, e.g. `Aplime <notifications@yourdomain.com>` |
| MICROSOFT_TENANT_ID | Yes | Microsoft Entra tenant ID |
| MICROSOFT_CLIENT_ID | Yes | Entra app client ID |
| MICROSOFT_CLIENT_SECRET | Yes, secret | Entra app client secret |

This uses OAuth client credentials, **not SMTP username/password basic authentication**. Configure `SMTP.SendAsApp`, admin consent, Exchange service-principal registration, mailbox permissions, and SMTP AUTH for the sending mailbox. Firebase handles authentication verification/recovery emails; Microsoft 365 sends project/account activity alerts.

## Sentry monitoring

| Variable | Required | Value or source |
| --- | --- | --- |
| SENTRY_DSN | Optional, recommended before launch | Server Sentry project DSN |
| PUBLIC_SENTRY_DSN | Optional, intentionally public | Browser/mobile Sentry project DSN |

APP_ENV and RENDER_GIT_COMMIT label errors automatically. Default PII collection is disabled; requests, users, and breadcrumbs are stripped from sent events. Session replay and source-map uploads are not enabled. No Sentry auth token is required unless you later add source-map publishing.

## GitHub-only deployment and signing values

Keep these in **GitHub Settings → Environments → development / stagging / production**, not Render. The build runners require them before any app process exists.

Variables: `SITE_URL`, `API_URL`, `ADMIN_URL`, `RENDER_WEB_SERVICE_ID`, `RENDER_API_SERVICE_ID`, `RENDER_ADMIN_SERVICE_ID`, `RENDER_WORKER_SERVICE_ID`, `BACKEND_RELEASES_ENABLED`, `MOBILE_RELEASES_ENABLED`. The old `RENDER_SERVICE_ID` is no longer used.

Keep `BACKEND_RELEASES_ENABLED` unset or `false` while previewing only the customer/admin websites. This skips API and mail-worker deployments, so authenticated marketplace features remain unavailable. Set it to `true` only after the development backend environment group passes `npm run config:check` and the database migration succeeds. Keep `MOBILE_RELEASES_ENABLED` unset or `false` until both mobile signing pipelines are configured.

Secrets: `RENDER_API_KEY`, `GOOGLE_SERVICES_JSON_BASE64`, `GOOGLE_SERVICE_INFO_PLIST_BASE64`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_BASE64`, `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROFILE_BASE64`, `IOS_PROFILE_NAME`, `KEYCHAIN_PASSWORD`.

Generated by the pipeline, not manually entered: `APP_ENV`, `MOBILE_APP_ID`, `ANDROID_TRACK`, `BUILD_NUMBER`, `ANDROID_KEYSTORE_PATH`, `PLAY_JSON_PATH`, `IOS_CERTIFICATE_PATH`, `IOS_PROFILE_PATH`, `BUNDLE_GEMFILE`, GitHub's `GITHUB_SHA/GITHUB_REF_NAME/GITHUB_RUN_NUMBER/GITHUB_RUN_ATTEMPT`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for each signing secret's format. Mobile packaging fetches public config from the matching API_URL, avoiding a second set of Firebase web values in GitHub.

## Validation

Run `npm run config:check` after configuring an environment. It prints missing variable **names**, never secret values. Production processes run the same check at startup. Development/stagging reject Stripe live keys; production rejects Stripe test keys.

Application values are validated centrally in `src/server/config.ts`; public exposure is an explicit allowlist. Never add a private credential to that public object.

References: [Render environment groups](https://render.com/docs/blueprint-spec#environment-groups), [Render Postgres TLS](https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections), [Microsoft SMTP OAuth](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth).

## Professional subscriptions (current billing model)

Aplime bills professional businesses only. Customer project checkout and new Stripe Connect onboarding are disabled. Existing payment history and legacy signed webhook/refund handling are retained for reconciliation, not new transactions.

Add `STRIPE_PRO_PRICE_ID` to the backend Render environment group for each environment. In Stripe Dashboard, create an Aplime Professional product with your chosen recurring USD price, and copy its `price_...` ID. No amount is hardcoded. Use test-mode keys/prices in development and stagging and live-mode keys/prices in production. Existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain required. `STRIPE_CONNECT_WEBHOOK_SECRET` is only needed if reconciling historical Connect events; it is no longer a required launch variable.

Configure the Stripe Customer Portal to allow invoices, payment-method updates and subscription cancellation. Add `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` to the standard `/api/webhooks/stripe` endpoint alongside existing identity events. Status is read from Stripe by signed webhooks, never from a checkout return URL. Existing subscriptions using another price must be migrated deliberately before changing the configured price.

Run `npm run db:migrate` before the updated API starts (the existing Render pre-deploy command does this). Migration 003 adds business details and professional subscription state. An active or trialing subscription is required for public discovery and new estimates; existing work and conversations remain accessible. Existing professionals need to complete their expanded profile and enroll before appearing in search.


### Missing professional subscription price during deployment

If API pre-deploy reports `Missing deployment configuration: STRIPE_PRO_PRICE_ID`, create or select the professional membership's recurring USD Price in the Stripe test environment matching the development API key. Copy the actual `price_...` identifier (not a product `prod_...` identifier or the numeric amount) into the development backend Render group. Save and deploy the API, allowing config validation and database migration to complete. For environment groups with automatic deployment disabled, explicitly trigger a new deploy; a restart reuses the previous deployment configuration.

The mail worker validates only database and Microsoft SMTP settings: `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_CLIENT_SECRET`. Database TLS configuration still applies. It can keep using the existing backend group, but no longer requires Stripe/Firebase/Daily/R2/Maps configuration to start. The API's complete deployment checks remain unchanged.
