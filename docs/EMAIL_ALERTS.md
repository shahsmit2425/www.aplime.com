# Aplime event email alerts

The API queues emails in the same transaction as the event notification. The existing background worker sends branded HTML and plain-text alternatives through the existing Microsoft SMTP configuration. No new environment-variable names or separate sender mailboxes are required. `SMTP_FROM` remains the sender; the worker also needs the existing `SITE_URL` to build customer account links. Production worker startup requires an exact HTTPS origin.

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

After eight failed attempts, the worker stops automatic retries and creates an administrator **in-app** alert. It does not recursively send failure emails through a broken provider. Fix SMTP configuration before retrying. A `sent_at` timestamp means SMTP accepted the message, not proof of inbox delivery or reading. Crashes between SMTP acceptance and database acknowledgement can cause a retry; the same Message-ID is reused, but SMTP cannot guarantee exactly-once delivery. Bounce/spam tracking requires provider integration and is not implemented here.

Deletion confirmations use a short-lived address snapshot after account anonymization. The worker clears it after successful sending, cancellation, or once it is over seven days old. Normal queued emails for deleted accounts are skipped. Shared support/project/audit records remain under the existing retention policy.

## Deployment and Stripe setup

1. Deploy the API with forward-only migration **024_event_email_alerts.sql** before the updated worker, customer and admin clients.
2. Keep the existing SMTP/Microsoft variables and `SITE_URL` attached to the worker. No new secrets, aliases or sender accounts are needed.
3. In the **development/test Stripe subscription webhook destination**, keep `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`; add `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, and `invoice.upcoming`. Keep the existing endpoint `${API_URL}/api/webhooks/stripe-subscriptions` and signing secret. Keep Identity events on its separate destination. Membership access still depends on subscription state, not invoice email delivery.
4. Invoice events are matched to stored customers/subscriptions and supported membership prices. Stale failed-payment events are checked against the invoice's current state; duplicate webhook events/semantic invoice alerts are deduplicated. Historical service-payment routes are unchanged.
5. Validate a real development signup, unread chat, confirmed call, business review, support message and test-mode membership flow. Check Email & alerts and the receiving inbox. No live provider emails were sent during implementation tests.

Stripe's own receipts may also be enabled. Decide which receipt sender to use before production to avoid duplicate payment emails. Adding invoice events to the Stripe destination is an external dashboard step; deploying this code does not modify Stripe configuration.
