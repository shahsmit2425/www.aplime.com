# Provider setup

## Firebase

Create separate development, staging and production Firebase projects. Register a web app plus the matching iOS and Android IDs from `config/environments.json`. Enable email/password, Google and Apple sign-in. Add website domains under Authentication → Authorized domains. Keep service-account credentials only in Render.

Native Google configuration uses the Capacitor Firebase Authentication plugin, native provider credentials and the Firebase JavaScript SDK. For Android, register upload and Play App Signing certificate SHA-1/SHA-256 fingerprints. For iOS, use a Firebase plist containing REVERSED_CLIENT_ID; the mobile script adds that callback scheme. Provisioning profiles must allow Sign In with Apple. Complete Apple's service/key configuration in Firebase for Apple authentication.

New profiles choose customer or professional once; the API stores the role. To create an administrator, an operator must set a Firebase custom claim `admin: true` and update that user's database role to `admin`. Never expose this operation as a public signup option. Both are checked on every admin request.

## Stripe

Enable Connect Express and Identity. Each professional saves their profile, completes Stripe-hosted document/selfie verification, then completes Connect payout onboarding. Document verification is not a background check, license check, insurance certification, or guarantee of workmanship.

Create a webhook destination at `https://YOUR_API_DOMAIN/api/webhooks/stripe`. Subscribe to Identity verification events, platform Checkout completion/async success, and charge refunds. Create a separate connected-account destination for `account.updated` at `/api/webhooks/stripe-connect`, with `STRIPE_CONNECT_WEBHOOK_SECRET`. Use the API domain for both destinations and test-mode events in non-production; enable live events only in production.

Stripe Checkout charges the customer after completion, applies the configured platform fee, and sends the remainder to the professional's connected account. Review the fee and Stripe/platform liability arrangement before launch. Client redirects are informational: the webhook remains authoritative.

## Resend email delivery

Verify your sending domain in Resend and create a sending API key. Put RESEND_API_KEY and EMAIL_FROM in the API/worker backend group; EMAIL_REPLY_TO is optional. The worker submits branded HTML/plain text via HTTPS with stable outbox idempotency keys. Preserve Microsoft 365 receiving MX records and existing inboxes. See EMAIL_ALERTS.md for cutover, diagnostics, retry limits and DNS precautions.

Run one or more `npm run worker` processes; row locking prevents normal concurrent double-processing. Failed sends retry with backoff, then remain in `email_outbox` after eight failures for operator investigation. Monitor oldest unsent age and exhausted attempts.

## Daily

Create a Daily account and supply the REST API key. The server creates private rooms per project and issues one-hour non-owner meeting tokens to authorized participants. Tokens expire and eject at expiry. No recording is enabled. Audio calls start with video off. Calls open in the browser/system calling window; both participants join from the same project.

Incoming call notifications appear in-app on the next refresh, with an email alert if enabled. Native push notifications, CallKit/ConnectionService, background ringing, and recordings are not implemented.

## Cloudflare and R2

Use separate private buckets and bucket-scoped credentials. Apply CORS like this, replacing the site origin per environment:

```json
[{
  "AllowedOrigins": ["https://dev.yourdomain.com", "capacitor://localhost", "https://localhost"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["Content-Type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

Files are limited to JPEG/PNG/WebP/PDF and 10 MB per upload. The server validates declared and uploaded metadata; it is not a malware-scanning or content-inspection service. Downloads use attachment disposition. Set appropriate storage retention and add scanning before broad public file sharing if your launch policy requires it.

Use Cloudflare for DNS and edge protection; keep Render responsible for application hosting. Do not cache authenticated API responses. Custom domains follow the Render-provided DNS targets.

## Upstash, Maps and Sentry

Use an Upstash REST database per environment for distributed rate limiting. Provision Google Geocoding API access for ZIP-based location lookup. Use separate Sentry projects or environment filters, configure alerts in Sentry, and verify that no request bodies or authentication headers are ingested.

## External validation required

Provider configuration cannot be proven with dummy keys. After setup, test a real Firebase email verification, Google/Apple login on each platform, Stripe test Identity/Connect/Checkout/webhook/refund, R2 upload/download, two-participant Daily call, Maps lookup and a delivered Microsoft 365 email. Then repeat appropriate smoke tests against the live environment.

Primary references:
- [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Capacitor Firebase Authentication](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/)
- [Stripe Identity](https://docs.stripe.com/identity/verify-identity-documents)
- [Daily room tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token)
- [R2 signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)
- [TestFlight automation](https://docs.fastlane.tools/actions/upload_to_testflight/)
- [Google Play automation](https://docs.fastlane.tools/actions/supply/)
