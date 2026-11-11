# Request security operations

## What the application enforces

The customer web server rejects authority-like redirect paths (including encoded slashes/backslashes) and malformed paths before redirecting. Canonical-host redirects use the configured SITE_URL origin, never a request-supplied host.

HTTP limits and WebSocket upgrades use the same configured trusted-proxy walk, from the socket peer toward the client. Untrusted forwarded prefixes and CF-Connecting-IP are not accepted as client identity. IPv6 client limits group a /56 network. The Render default retains one trusted hop; this is a configuration default, not evidence of the deployed topology.

New application account creation is limited to 5 per client network/hour and 3 attempts per Firebase UID/hour. Existing accounts bypass the creation guard. Project creation is limited to 20 per client network/hour and 10 per UID/hour, before paid address resolution. Existing database daily project quotas remain in place. Attempts count even when later validation/persistence fails. Local bounded counters reduce Redis traffic; Upstash shared counters enforce the policy across API replicas. A timeout, error, or missing shared store in NODE_ENV=production fails closed with 503. Exhausted limits return 429.

Anonymous intake has its existing 90 lookups/network/10 minutes plus a shared daily request budget (default 3000). This budget can be exhausted by abuse and temporarily prevent legitimate lookups; monitor 429s and adjust only against observed usage and provider quotas. It does not cover all authenticated Maps traffic or guarantee a maximum bill.

WebSocket capacity is 30 connections/client network, 10 authenticated connections/user, and 5000 connections/API process. Unauthenticated sockets are terminated after five seconds. Connection capacity is per process, not a distributed global limit; ticket use and recipient isolation remain enforced.

## Render staging verification before production

1. Keep the existing Upstash REST rate-limit settings on the API. Deploy the API and customer web changes to development first.
2. Using an approved, MFA-authenticated admin session, request `GET /api/admin/network-check` with the same authorization used by other admin requests. The endpoint is admin-only, no-store, and audit-logged. It returns detected client IP, peer IP and proxy trust configuration. Keep authorization tokens private.
3. Repeat from two different networks (for example home broadband and mobile data). Detected client IPs must follow the client network, not remain the Render proxy address.
4. Repeat with a deliberately false X-Forwarded-For prefix using your authenticated API test client. It must not replace the actual client IP. Also test both the custom domain and any reachable onrender.com entry point.
5. If results differ, inspect the real ingress topology before changing TRUST_PROXY_HOPS. When routes have different lengths, use verified trusted CIDRs or restrict ingress to a single controlled path. Do not blindly change 1 to 2 for Cloudflare or trust all forwarded headers. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies.html).
6. Verify two signed-in accounts can receive live updates independently. Check 429/503 rates and Redis availability; confirm a controlled shared-store outage blocks protected requests and recovers after restoration. Do not run deliberate load tests against production.

## Provider settings still required

- In Google Cloud, apply API restrictions to the server Maps key and set appropriate supported per-API request quotas. Review Places and Geocoding usage separately. Add billing alerts; alerts alone do not cap spending. Choose quotas from actual expected traffic and test legitimate intake afterward.
- Firebase account creation happens directly in the Firebase client SDK. The API guard limits Aplime account provisioning, not creation of raw Firebase identities. Review Firebase signup quotas and supported bot protection/App Check integration for the project's authentication configuration. App Check/captcha is not enabled or enforced by this change; a future rollout must include client integration, monitoring and provider enforcement together.
- Never substitute captcha, IP limits or App Check for verified identity, server ownership checks or project quotas.

Live Render headers, real Firebase signup protection, multi-replica Redis behavior and Google billing settings must be checked in the actual provider accounts. Local tests use provider mocks and do not establish those production settings.
