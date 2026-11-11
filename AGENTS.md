# Repository working rules

- Start all new work from development. Promote development → stagging → main through reviewed pull requests. Do not implement separate application logic for each environment.
- Keep environment mapping in config/environments.json. Application values belong in Render environment groups, signing/deployment credentials in GitHub Environments. Never commit secrets or generated native Firebase files.
- Admin UI changes belong only in apps/admin; never import admin screens into the customer bundle. Keep scripts/affected.mjs aligned with actual runtime dependencies.
- Each environment has a common group for all application services and a backend group linked only to API/worker. Keep credentials out of the common group and frontend build/runtime environments. Browser bundles and public config must never expose API secrets or DATABASE_URL; maintain explicit public-value allowlists. Admin access must fail closed without approved UID, claim, database role and recent TOTP authentication.
- Web, iOS and Android share src/client, src/shared and src/styles.css. A UI or domain change must build for every platform.
- Never introduce seeded marketplace users, fabricated ratings, sample transactions, bypass authentication or client-controlled administrator roles.
- API authorization, validated amounts and lifecycle checks belong on the server. Stripe webhooks determine verification/payment outcomes.
- Public pages must remain server-rendered with truthful metadata. Private and non-production pages must remain noindex.
- Add forward-only migrations under src/server/db/migrations. Never edit a migration that has already been deployed.
- Update docs/ENVIRONMENT_VARIABLES.md whenever configuration changes. Keep private keys out of the public config allowlist.
- Run npm run typecheck, npm test and npm run build for meaningful code changes. Run npx cap sync after client/native dependency changes.
- Do not claim external deployment, integration or signed native verification without evidence. Document any untested boundary in docs/VALIDATION.md.
