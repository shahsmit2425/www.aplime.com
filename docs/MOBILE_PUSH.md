# Mobile push notifications

Native iOS and Android use `@capacitor-firebase/messaging` 7.x and the existing Firebase Admin credentials. Web retains in-app alerts and email; browser push is not enabled.

## Deployment order

1. Enable Push Notifications for the Apple App ID. Development TestFlight uses `com.aplime.app.dev` and production APNs, despite the development backend.
2. Upload the APNs `.p8` authentication key to the matching Firebase project's Cloud Messaging Apple app settings. Keep the key out of the repository and Render. It is separate from the App Store Connect API key.
3. Regenerate the App Store distribution provisioning profile and replace GitHub development `IOS_PROFILE_BASE64`. Update `IOS_PROFILE_NAME` only if renamed. The checked-in entitlement is production for the distribution/TestFlight workflow; a local Xcode debug build needs sandbox signing/entitlements.
4. Apply migration `029_mobile_push.sql` with the existing `npm run db:migrate` process before starting the updated API/worker. Deploy both API and worker from the same release.
5. Link the existing backend Firebase credentials to the worker as well as the API: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. No new variable names are introduced. The service account needs permission to send Firebase Cloud Messaging messages in that project (Firebase Cloud Messaging API Admin role or equivalent `cloudmessaging.messages.create` permission); the HTTP v1 API must be enabled. Never expose these credentials in frontend environments.
6. Build a new signed TestFlight version using the normal GitHub workflow. Capacitor sync installs the messaging plugin; macOS CI must complete CocoaPods and Xcode archive steps.
7. On the iPhone, sign in, open More → Settings → Push notifications → Enable notifications, and allow the iOS prompt. Each device opts in separately. Sign-out disconnects that device and clears opt-in, so enable it again after signing in.

## Delivery and privacy

Existing in-app notification inserts transactionally create one push delivery per registered device. This covers events already producing in-app notifications, including messages, project/estimate changes, support replies and meetings. It does not create new event rules or replace Resend. Existing pg-boss workers process the `push-delivery` queue every few seconds, with a minute schedule fallback. Legacy workers also process it.

Only generic lock-screen content and a notification ID are sent. Tapping resolves the destination using the signed-in user's authenticated API; no private message body, address, phone number or arbitrary URL is in the payload. Already-read, deleted-account, revoked-session and reassigned-device notifications are skipped. Admin accounts are not registered by the customer app. Notifications already handed to Apple cannot be recalled reliably.

Temporary send failures retry six times with backoff, then remain failed for inspection. Invalid/unregistered tokens are removed. Old deliveries expire after one hour to avoid stale meeting alerts. APNs/Android TTL is at most one hour after submission. Delivery is at least once; a process crash after provider acceptance can repeat a notification. Notification IDs are collapse/tag identifiers, but this is not an exactly-once guarantee.

Maximum ten devices per user; inactive tokens expire after 60 days and completed delivery records after 30 days. Disabling on-device notifications or signing out unregisters the token. Account deletion/session revocation also removes registered devices. If both server deregistration and Firebase token invalidation fail during sign-out, the app asks the user to reconnect before completing sign-out.

These are ordinary alerts, not VoIP/CallKit incoming calls or guaranteed emergency delivery. An offline phone needs connectivity before receiving pushes; Focus, notification permission, battery policy and expiry can affect delivery.

## Test on a real device

Enable notifications in the new TestFlight build. Background or lock the phone while remaining signed in. From the other account send a new message or request a meeting. Verify an alert appears, tap it, and verify the correct conversation/meeting opens after authentication. Repeat with the app terminated, two devices, permission denied, device offline then reconnected, sign-out, and a different account on the same device. Sign-out must stop alerts for the previous account.

Worker logs report a delivery ID and sanitized Firebase error code only. Inspect queue counts without exposing tokens:

```sql
SELECT status, count(*) FROM push_deliveries GROUP BY status;
SELECT id, status, attempts, last_error, next_attempt_at
FROM push_deliveries WHERE status IN ('pending','failed') ORDER BY id DESC LIMIT 20;
```

`sent` means Firebase accepted the message, not proof it appeared on the phone. Verify the APNs key, bundle ID, Firebase project, profile and device permission if accepted notifications are not displayed.
