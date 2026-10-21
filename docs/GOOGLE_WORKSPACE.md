# Google Workspace staff mail and Resend alerts

## Responsibilities

| Component | Responsibility |
| --- | --- |
| Google Workspace / Gmail | Staff send and receive business email; support receives customer replies |
| Resend | Sends automated Aplime event emails over HTTPS |
| PostgreSQL + pg-boss worker | Durable email outbox, scheduling and retries |
| Firebase | Existing website authentication, verification and password reset emails |

Website event -> transactional email outbox -> background worker -> Resend -> recipient.
Reply -> EMAIL_REPLY_TO address -> Google Workspace inbox. Replies do not become website chat messages or support tickets automatically. Staff messages sent manually from Gmail do not pass through the Aplime outbox.

All application alert categories currently share EMAIL_FROM and EMAIL_REPLY_TO. Adding a billing mailbox does not automatically route billing alerts through that sender.

## Backend configuration

```dotenv
RESEND_API_KEY=re_your_private_key
EMAIL_FROM=notification@aplime.com
EMAIL_REPLY_TO=support@aplime.com
SUPPORT_EMAIL=support@aplime.com
```

Use plain email addresses. RESEND_API_KEY, EMAIL_FROM and optional EMAIL_REPLY_TO belong in the backend group linked to API/worker only. SUPPORT_EMAIL remains the separate public contact setting, exposed through the existing explicit allowlist. No new environment variables, database migration, worker or runtime email dependency is required for Google Workspace mailboxes. Do not add Google SMTP credentials, app passwords, Workspace client secrets or service-account keys for this arrangement. Existing Firebase/Maps Google credentials serve unrelated purposes and must remain.

## Fresh setup and cutover

The owner elected not to migrate existing Microsoft email, contacts or calendars. This document does not authorize deletion of unrelated OneDrive/SharePoint files, Azure resources or identities used by other services.

1. Register Google Workspace for the existing domain aplime.com. The owner completes passwords, recovery methods, subscription selection and agreements. Verify domain ownership with the exact DNS record shown by Google; ownership verification alone does not switch incoming mail.
2. Create the administrator and required staff mailboxes before changing mail routing. Keep admin1@aplime.com if it is the existing website administrator email. Configure support@aplime.com, billing@aplime.com and notification@aplime.com as separate mailboxes or aliases as appropriate. An alias shares its owner's inbox and cannot serve as an independent staff login. Resend does not require a Google mailbox for every sending address; configure a receiving address if replies to it need to arrive.
3. Enable administrator two-step verification and set recovery access. Preserve existing Firebase users, UIDs, administrator allowlists, custom claims and TOTP enrollment. Moving an inbox is not a website identity migration. Do not recreate the Firebase administrator merely because its mail provider changes.
4. When Google recipients are ready, replace only the existing Microsoft root receiving MX records with the exact Google Workspace values shown in its setup tool. Retain website, Render, Firebase and Resend DNS records. Keep Resend inbound receiving disabled. Its return-path MX record (commonly under send) serves a different hostname and purpose from root receiving MX; do not remove it as part of replacing Microsoft's root MX.
5. Configure Google's SPF and DKIM instructions and retain Resend's sending authentication. Publish at most one SPF TXT record per hostname; merge authorized senders at that hostname instead of adding competing records. Do not copy generic DNS values over the provider's displayed records. Review existing DMARC alignment and reporting; do not weaken an existing policy simply to make a test pass.
6. Verify aplime.com for sending in Resend to use notification@aplime.com. Set the backend values above and deploy the Resend release to API and worker. Keep npm run worker and the existing pg-boss queues. Google Workspace requires no website code change.
7. Complete the acceptance checks below. Keep Microsoft accounts and the administrative recovery route available until both incoming Google mail and outgoing Resend alerts work; DNS changes can take time to reach other senders.
8. After successful cutover, remove the obsolete SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET from Aplime backend groups and service overrides. Revoke the dedicated old Entra SMTP application's credentials, consent and Exchange mailbox grants only if configured and unused elsewhere. Keep Firebase credentials and administrator UID settings.
9. The owner can then remove unwanted Microsoft users and cancel the Microsoft 365 subscription according to its billing terms. Preserve a working onmicrosoft.com administrator until domain removal/cancellation is complete. Review remaining resources and dependencies before optional tenant deletion; deleting a tenant is separate from stopping Microsoft email. Google domain verification does not require deleting the Microsoft tenant first. Permanent deletion and subscription agreements require the owner's final action/confirmation.

## Acceptance checks

- Send external email to each Google mailbox/alias and confirm arrival in Gmail. Send a staff reply and confirm external receipt; inspect authentication results for SPF/DKIM/DMARC.
- In the updated Render worker Shell, run npm run email:check (configuration validation only). Then run npm run email:check -- --to YOUR_CONTROLLED_EMAIL to send one explicit direct test. Check Resend history and actual inbox/spam receipt; provider acceptance alone is not delivery proof. This diagnostic bypasses outbox history.
- Publish one real development project with an eligible professional and enabled alerts. Verify the in-app event, admin Email & alerts record, Resend status and recipient inbox. Do not bulk replay old opportunities.
- Reply to the alert and verify receipt in the Google Workspace support inbox. Confirm no expectation of an automatic website chat/ticket entry.
- Confirm existing website administrator sign-in and Firebase verification/password-reset delivery still work. Do not change Firebase account IDs or website roles to fix mailbox routing.
- Confirm support links still point to the intended address. Apply environment settings separately to development, staging and production; use distinct Resend API keys.

No live setup, mailbox deletion, subscription cancellation, DNS update or delivery test is performed by adding this document. If incoming mail fails during cutover, restore the recorded previous receiving MX only while the Microsoft mailboxes still exist; queued website alerts remain in PostgreSQL independently. Do not fall back to Microsoft SMTP after an ambiguous Resend timeout.

## Official references

- [Google Workspace setup](https://workspace.google.com/)
- [Google MX setup](https://support.google.com/a/answer/6156494)
- [Google email aliases](https://support.google.com/a/answer/33327)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Microsoft 365 cancellation](https://learn.microsoft.com/en-us/microsoft-365/commerce/subscriptions/cancel-your-subscription?view=o365-worldwide)
