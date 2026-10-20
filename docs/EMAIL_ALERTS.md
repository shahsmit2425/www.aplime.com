# Aplime event email alerts

The API queues emails in the same transaction as the event notification. The existing background worker sends branded HTML and plain-text alternatives through the Resend HTTPS API. Configure backend-only `RESEND_API_KEY` and `EMAIL_FROM`; optional `EMAIL_REPLY_TO` points replies to an existing inbox. All alert categories currently use this one configured sender; category-based multiple senders are not introduced here. The worker also needs the existing `SITE_URL` to build customer account links. Production worker startup requires an exact HTTPS origin.

## Events

| Category | Events covered | Delivery |
| --- | --- | --- |
| Account | Welcome after verified account creation; sign out all devices; deletion confirmation | Immediate queue; sign-out/deletion essential |
| Projects and estimates | Published requests, matching opportunities, project-detail updates, assessment requests, received/updated/withdrawn/expired estimates, selected estimates, professional acceptance/decline, withdrawn awards, opportunities awarded elsewhere/reopened | Immediate queue through existing event notifications |
| Work | Started, paused, resumed, completion requested/confirmed/declined, cancellation requests/responses/withdrawals, cancellations, disputes and resolutions | Immediate queue to existing authorized recipients |
| Messages | Unread customer/pro conversations | Two-minute delay; combine unclaimed emails for the same recipient/conversation; no more than one sent batch per 15 minutes. Skip if the latest message notice was read or the relationship is blocked/suspended before sending. No message content in email |
| Meetings and visits | Call requests, accepted/declined proposals, rescheduling, cancellation; visit proposals/confirmations | Immediate queue |
| Business and identity | Review submission, decisions, changes requested, suspension/restoration; verified/requires-input/cancelled Identity outcomes | Immediate queue; suspension/restoration essential |
| Membership | Activated/ended/attention needed, cancellation scheduled/reversed, confirmed plan changes; paid invoice, failed payment, authentication required, upcoming renewal | Signed Stripe events and authoritative provider retrieval; essential |
| Reviews | New review, professional reply, invitation following confirmed project completion | Immediate queue or next reminder scan |
| Support | Administrator-initiated messages, replies, resolved/reopened cases; existing support acknowledgements | Immediate queue; direct Aplime support messages essential |

Reminder scans run once a minute in bounded batches. Confirmed calls get one reminder within ten minutes of the start; confirmed booked visits get one within 24 hours; pending estimates get one within 24 hours of expiry. A pending call gets one response reminder per proposal version after 24 hours and **does not expire**. Review invitations are limited to recently confirmed completions without a review. Receipt keys prevent repeated scans from creating duplicate alerts; relevant state is checked again before delivery. Rescheduled confirmed calls/visits can receive a reminder for their new time.

Preference saves, personal archive/restore actions and automatically completed calls remain in-app notifications without email. Matching fan-out retains the existing ranked cap of 50 professionals; this does not broadcast to every account. Pending reminders do not auto-confirm, cancel or book work. Email links require sign-in and do not contain Daily room tokens, Stripe portal sessions, identity documents or project files.

Firebase continues to own email verification and password reset emails. Password-changed, email-changed and suspicious-login notifications require reliable provider-side event integration before adding them; this implementation does not guess these outcomes from browser clicks. No marketing campaigns, weekly digests or inbound email-to-chat synchronization are introduced.

## User and administrator controls

Users manage optional project, message, meeting, business, review and support emails in **Settings**. The existing master switch remains supported. Security, membership billing, account restrictions and direct administrator support messages may still be sent; the UI explains this. Preferences are checked when queuing and immediately before delivery, so turning alerts off also skips pending optional mail. In-app notifications continue.

Administrators use **Email & alerts** to inspect paginated delivery history, filter failed/pending/sent/skipped mail, pause optional categories, preview the shared template, and retry exhausted unsent deliveries. Controls and delivery reads are audited. “Send a message to a user” opens People, where the existing Contact user flow creates a private support conversation and email alert. There is no public email endpoint or ability to send to an arbitrary address. Template content is version-controlled rather than editable raw HTML in the browser.

After eight failed attempts, the worker stops automatic retries and creates an administrator **in-app** alert. It does not recursively send failure emails through a broken provider. Fix Resend configuration before retrying. A `sent_at` timestamp means the provider accepted the message, not proof of inbox delivery or reading. Historical sent records can predate the provider switch. The stable outbox Message-ID is reused and hashes to a Resend idempotency key, which Resend retains for 24 hours. Retries beyond that window can still duplicate accepted mail; changed payloads under a retained key may be rejected rather than duplicated. Network timeouts, rejection, rate limits and malformed success responses leave the delivery unsent for the existing backoff/retry policy. Safe provider codes/status are logged without response bodies, recipient details or credentials. Delivery/bounce webhook tracking is not implemented here.

Deletion confirmations use a short-lived address snapshot after account anonymization. The worker clears it after successful sending, cancellation, or once it is over seven days old. Normal queued emails for deleted accounts are skipped. Shared support/project/audit records remain under the existing retention policy.

## Deployment and Stripe setup

1. Deploy the API with forward-only migration **024_event_email_alerts.sql** before the updated worker, customer and admin clients.
2. Configure `RESEND_API_KEY`, `EMAIL_FROM` and optional `EMAIL_REPLY_TO` in the API/worker backend group, keeping `SITE_URL` for account links. Follow the Resend cutover steps below.
3. In the **development/test Stripe subscription webhook destination**, keep `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`; add `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, and `invoice.upcoming`. Keep the existing endpoint `${API_URL}/api/webhooks/stripe-subscriptions` and signing secret. Keep Identity events on its separate destination. Membership access still depends on subscription state, not invoice email delivery.
4. Invoice events are matched to stored customers/subscriptions and supported membership prices. Stale failed-payment events are checked against the invoice's current state; duplicate webhook events/semantic invoice alerts are deduplicated. Historical service-payment routes are unchanged.
5. Validate a real development signup, unread chat, confirmed call, business review, support message and test-mode membership flow. Check Email & alerts and the receiving inbox. No live provider emails were sent during implementation tests.

Stripe's own receipts may also be enabled. Decide which receipt sender to use before production to avoid duplicate payment emails. Adding invoice events to the Stripe destination is an external dashboard step; deploying this code does not modify Stripe configuration.

## Resend cutover from Microsoft SMTP

1. Keep the Microsoft 365 tenant, licensed users and shared mailboxes that receive your business mail. Switching the website's outbound provider does not migrate those inboxes. Do not delete receiving MX records, cancel licenses or release the tenant as part of this change.
2. In Resend add `aplime.com` as a sending domain if you want the exact sender `notification@aplime.com`. If you instead verify only a subdomain, use a sender on that verified subdomain. Add the sending verification, DKIM and return-path records Resend provides, preserving existing Microsoft receiving MX records. Enable sending only; do not enable inbound receiving or replace the root MX unless deliberately migrating incoming mail. Do not create two SPF TXT records at one hostname; merge authorized senders if that same hostname needs an update. See [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction).
3. Wait for domain verification. Create a sending API key restricted to that domain where possible. Keep separate keys for development and production. This version needs only `RESEND_API_KEY` and `EMAIL_FROM`; optional `EMAIL_REPLY_TO` identifies a receiving mailbox. Do not add EMAIL_PROVIDER; there is no provider-selection switch. Do not put the key into common groups, source control, screenshots or frontend builds.

```dotenv
RESEND_API_KEY=re_your_private_key
EMAIL_FROM=notification@aplime.com
EMAIL_REPLY_TO=support@aplime.com
```

4. Add the new values to the backend environment group linked only to API/worker, leaving the old credentials temporarily present while older services still run. Deploy the updated API (normal config check/migrations), then the existing worker, then admin. This change adds no migration and does not replace existing outbox records, receipt keys, preferences, matching or pg-boss queues. Keep the worker start command `npm run worker`.
5. Run `npm run email:check` in the configured worker Shell (or API Shell). It validates configuration without an API request or email. Then explicitly send one test to an inbox you control with `npm run email:check -- --to YOUR_EMAIL`. It prints only safe error codes or the accepted provider ID. This one-off operator test bypasses the outbox and does not create an admin delivery record. Do not put secrets in command arguments.
6. Test a real development project publication with an eligible category/location-matched pro and enabled email alerts, and an administrator support message. Confirm in-app notifications, Email & alerts acceptance and actual inbox delivery. Invalid credentials, an unverified sender, daily quotas or rate limits leave the row unsent and trigger the existing retry policy. A successful provider response with a valid ID marks it accepted; bounce/delivery webhook reconciliation is not part of this release.
7. Pending unsent records resume automatically if retries remain. Exhausted records are not silently reset: after fixing configuration, an administrator can use Email & alerts -> Failed -> Retry. Avoid a bulk replay of old opportunities without checking relevance.
8. Once the API and worker run this release and acceptance/inbox tests pass, remove `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` from Aplime backend groups and service overrides. Keep `SUPPORT_EMAIL`, `SITE_URL`, database, Redis and other unrelated settings. Blueprint synchronization removes old managed defaults; manually created variables may need manual removal. Only revoke the old Entra SMTP application's secret/consent and mailbox grants after confirming no other application uses them. Keep the Microsoft users/tenant for receiving mail and administration.

Rollback requires deploying the prior Microsoft SMTP code and restoring its old settings/permissions. No queued email data needs deletion. Do not automatically switch providers after an ambiguous timeout because a provider may already have accepted the message. Resend idempotency protects same-key retries within its [24-hour retention window](https://resend.com/docs/dashboard/emails/idempotency-keys), not arbitrary later resends.
