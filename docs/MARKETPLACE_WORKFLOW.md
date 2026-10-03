# Marketplace workflow

## Professional listing

1. A professional saves complete business details, a home ZIP code, and a service radius.
2. Stripe Identity verifies the account holder. Identity verification does not approve licensing, insurance, or the marketplace listing.
3. The professional adds a logo or cover image and at least one work photo.
4. The professional submits the listing for review.
5. An administrator approves it, requests specific changes, or rejects it. Every decision is audited and sent to the professional as an in-app and email notification.
6. A listing appears in public search only while it is approved, identity verified, available, not suspended, and backed by an active or trialing Aplime subscription.

Saving business details after approval returns the listing to draft. The professional must submit the updated information again. This prevents unreviewed content from replacing an approved listing.

## Customer project

1. A customer can save one private, cross-device project draft. Drafts may be incomplete and never appear to professionals.
2. Before publishing, the customer completes the service questionnaire, location, urgency, property type, optional budget, optional appointment proposal, and up to five photos.
3. A review screen shows the request before it is published.
4. Publishing geocodes the ZIP code and makes the request visible to every approved, subscribed, available professional. Category and service-area preferences are intentionally deferred; until they are added, professionals can filter the all-category opportunity list themselves. Direct requests still verify that the selected professional serves the requested category and location.
5. An eligible professional can start a private project chat, ask scope questions, submit an estimate, and invite the customer to an audio or video call before the customer chooses one. Calls use private Daily rooms created by the API.

## Estimate and work

1. An eligible professional sends an estimate with labor, materials, scope, exclusions, expected timeline, and optional expiration.
2. Revisions increment the estimate version. A customer cannot accept an older revision or an expired estimate.
3. Accepting an estimate assigns the professional, closes competing estimates, and moves the project to booked.
4. Either participant may propose an appointment; the other participant must confirm it.
5. The professional starts work and later requests completion. The customer confirms completion before review becomes available.
6. Service payment is arranged directly between the customer and professional. Stripe in Aplime is used for the professional subscription and identity verification, not project payments.

## Marketplace access rules

The API enforces review status, identity status, subscription status, suspension, availability, project state, participant access, and blocking. Open opportunity browsing, private-chat initiation, and estimates currently allow every service category and location. Category and service-radius checks remain in place for a customer's direct request to a specific professional. Client-side screens explain these rules but are not trusted for authorization.

Each pre-booking conversation is isolated by project and professional. Only that customer and professional may read or send its messages or request its Daily token. Daily rooms are private, limited to two participants, recording-disabled, and entered with one-hour room-scoped tokens. Once a customer books a professional, competing conversations become read-only.
