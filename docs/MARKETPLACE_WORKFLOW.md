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
5. The professional starts work and later requests completion. The customer confirms completion before review becomes available.
6. Service payment is arranged directly between the customer and professional. Stripe in Aplime is used for the professional subscription and identity verification, not project payments.

## Marketplace access rules

The API enforces review status, identity status, subscription status, suspension, availability, project state, participant access, blocking, service category and location matching. Matching governs the professional opportunity feed, new chat initiation, estimates, direct requests and new-project notifications. Existing discussions remain available to their participants according to project lifecycle rules. Changing category/radius/hours preferences does not reset business listing approval; editing public business content still does. Client-side screens explain these rules but are not trusted for authorization.

Each pre-booking conversation is isolated by project and professional. Only that customer and professional may read or send its messages or request its Daily token. Daily rooms are private, limited to two participants, recording-disabled, and entered with one-hour room-scoped tokens. Once a customer books a professional, competing conversations become read-only.
