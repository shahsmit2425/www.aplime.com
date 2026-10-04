# Marketplace workflow

## Professional listing

1. A professional saves complete business details and selects a full US business-base address using Google address suggestions. The street address is private; the public profile displays the ZIP and service area. Under Calendar & preferences, the professional selects service categories, a radius, a business time zone, and weekly opening hours.
2. Stripe Identity verifies the account holder. Identity verification does not approve licensing, insurance, or the marketplace listing.
3. The professional adds a logo or cover image and at least one work photo.
4. The professional submits the listing for review.
5. An administrator approves it, requests specific changes, or rejects it. Every decision is audited and sent to the professional as an in-app and email notification.
6. A listing appears in public search only while it is approved, identity verified, available, not suspended, and backed by an active or trialing Aplime subscription.

Saving business details after approval returns the listing to draft. The professional must submit the updated information again. This prevents unreviewed content from replacing an approved listing.

## Customer project

1. A customer can save one private, cross-device project draft. Drafts may be incomplete and never appear to professionals.
2. Before publishing, the customer completes the service questionnaire, a full US address selected from suggestions, optional apartment/unit, urgency, property type, optional budget, and up to five photos.
3. A review screen shows the request before it is published.
4. Publishing resolves the selected Google place on the server. The customer receives up to five eligible professionals for that project, matched by selected service category and geographic service radius, ordered by rating then ID. Professionals receive only matching opportunities and new-project notifications. Legacy records without coordinates fall back to an exact ZIP match. Their lead feed omits the customer's precise street address, unit, place ID and coordinates.
5. An eligible professional can start a private project chat, ask scope questions, submit an estimate, and invite the customer to an audio or video call before the customer chooses one. Calls use private Daily rooms created by the API.
6. Customers can open Project matches directly from their project and use Chat with pro on a matched business card. Repeated clicks reuse the private conversation. Saved profiles remain accessible, but saving does not grant permission to start unrelated project chats.

## Estimate and work

1. An eligible professional sends an estimate with labor, materials, scope, exclusions, expected timeline, and optional expiration.
2. Revisions increment the estimate version. A customer cannot accept an older revision or an expired estimate.
3. Accepting an estimate assigns the professional, closes competing estimates, and moves the project to booked.
4. After a professional is selected, either participant may propose a one-hour visit; the other must confirm it. Customers see the professional's weekly opening hours and business time zone. The form uses the viewer's device time zone. The server checks published hours and conflicting confirmed appointments both when proposing and confirming. Profile locking prevents simultaneous confirmations from double-booking a professional. No hours are invented for existing businesses: professionals must publish their calendar first.
5. Either assigned participant can start booked work and request completion. The other participant confirms completion or requests more work with a reason. Nobody can confirm their own completion request; customer reviews unlock only after confirmation.
6. Service payment is arranged directly between the customer and professional. Stripe in Aplime is used for the professional subscription and identity verification, not project payments.

## Marketplace access rules

The API enforces review status, identity status, subscription status, suspension, availability, project state, participant access, blocking, service category and location matching. Matching governs the professional opportunity feed, new chat initiation, estimates, direct requests and new-project notifications. Existing discussions remain available to their participants according to project lifecycle rules. Changing category/radius/hours preferences does not reset business listing approval; editing public business content still does. Client-side screens explain these rules but are not trusted for authorization.

Each pre-booking conversation is isolated by project and professional. Only that customer and professional may read or send its messages or request its Daily token. Daily rooms are private, limited to two participants, recording-disabled, and entered with one-hour room-scoped tokens. Once a customer books a professional, competing conversations become read-only.

## Project controls and recovery

| Action                       | Who can use it                                                 | Result                                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start work                   | Customer or selected pro, when booked                          | Moves to in progress; both get an update.                                                                                                                                                                             |
| Pause                        | Customer, or selected pro                                      | Requires a reason and remembers the previous stage. A public request leaves the opportunity feed. Pending completion/appointment proposals are cleared; confirmed appointments remain reserved. Chat stays available. |
| Resume                       | The participant who paused                                     | Restores the previous stage. An unassigned request alerts all currently matching eligible pros again. The other participant can ask for resumption in chat or contact support.                                        |
| Request/confirm completion   | Either participant requests; the other confirms                | Work stays in progress until confirmed. Requesting more work clears the pending completion and records a reason.                                                                                                      |
| Cancel before work starts    | Customer or selected pro                                       | Immediately cancels, closes pending estimates, releases the appointment and notifies relevant users.                                                                                                                  |
| Cancel after work starts     | Either participant requests; the other agrees or declines      | Other work actions are held until a decision. The requester may withdraw. Declining keeps the previous state. Support remains available.                                                                              |
| Withdraw estimate            | The pro who owns a pending estimate, while the request is open | The customer cannot accept it. A later resubmission receives a new revision and must still meet matching/eligibility requirements.                                                                                    |
| Remove an unassigned request | Its customer                                                   | Cancels and archives it for the customer. No shared records are permanently deleted.                                                                                                                                  |
| Archive/restore              | Either participant, for completed/cancelled work               | Changes only that user's project list. Restoring does not reopen work. The Archived checkbox reveals these records.                                                                                                   |
| Report an issue              | Either participant, during work, a pause or after completion   | Freezes normal work actions and alerts administrators. Resolving the case restores its prior stage.                                                                                                                   |

The API locks the project row and checks role, ownership and current state. Client actions include the displayed project version; stale actions are rejected and the workspace refreshes. Requests to cancel also carry a unique request ID, preventing a response to an earlier request from accepting a later one. An activity timeline records decisions and reasons. Customers see project history; selected professionals do not see competitors' activity details. Personal archive choices stay private.

Matching controls new opportunities. Open requests with a professional's existing pending estimate remain accessible for withdrawal even if that professional changes preferences or stops accepting work. Submitting a new/revised estimate must still pass matching and eligibility checks.

## Important notification events

Notifications are durable database records, delivered to active sessions using authenticated SSE. The bell, unread count, project data and conversations refresh after updates. Reconnection reloads durable records; periodic refresh remains a fallback. Email follows each user's email-alert preference and the existing mail outbox. A notification is committed together with the action; a rolled-back action publishes no event.

| Event                                                                                                                          | Recipients                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New public project                                                                                                             | Every eligible matching professional, plus a publication confirmation for its customer. The five-profile customer shortlist does not cap notifications. |
| Direct request                                                                                                                 | Its customer and selected professional.                                                                                                                 |
| Estimate sent/revised/withdrawn/declined                                                                                       | Customer and the professional concerned.                                                                                                                |
| Estimate accepted                                                                                                              | Customer and selected professional; previously alerted/interested pros receive a generic opportunity-closed update.                                     |
| Public request paused/cancelled/removed                                                                                        | Customer and previously alerted/interested pros; private reasons are not sent to unassigned pros.                                                       |
| Public request resumed                                                                                                         | Customer and every currently eligible matching pro.                                                                                                     |
| Appointment proposal/response, work start, pause/resume, completion request/response, cancellation request/response/withdrawal | Both assigned participants.                                                                                                                             |
| New chat/message or audio/video call invitation                                                                                | The other participant in that private conversation.                                                                                                     |
| Project files, reviews/replies, support and account/verification/subscription decisions                                        | Existing participant/account-specific alerts remain in place; administrators receive support/review items requiring their attention.                    |
| Archive/restore                                                                                                                | Only the person changing their project list. Repeating the same archive/restore has no additional effect.                                               |

This is realtime in-app delivery while connected, with durable recovery and optional email. It does not register browser push or APNs/FCM notifications for closed apps. Never expose notification data or stream credentials through a public URL.

Deploy migration `009_project_lifecycle.sql` before the updated API, then release the shared client. Users with an older open client must refresh before making project actions because the API requires the displayed project version. No new environment variable or notification vendor is required.
