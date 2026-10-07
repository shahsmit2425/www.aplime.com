# Administrator setup and access boundary

The administrator UI is a separately deployed static application. Its HTML/JavaScript and login screen are public files; sensitive data and actions are protected by the API. A separate domain is not authorization, and no system can promise that unauthorized access is impossible.

Every `/api/admin/*` request requires all of the following:

1. A valid Firebase ID token for this environment, verified with revocation checking and a verified email.
2. A Firebase UID explicitly listed in server-only `ADMIN_ALLOWED_UIDS`.
3. A server-issued boolean `admin: true` custom claim.
4. The same UID recorded with role `admin` in PostgreSQL.
5. A Firebase token recording TOTP as the sign-in second factor.
6. Authentication within the last hour. Refreshing an ID token does not extend this period.

Missing configuration denies access. Public registration accepts only customer/pro roles and cannot provision an admin, even when a caller submits extra fields. Admin identities are refused by customer workspace/account endpoints; admin data is available only through the protected admin namespace. Admins do not receive private conversation messages or attachments. Suspension, case resolution/refunds, and access provisioning are audited.

## Guided first-administrator setup (development)

Do this after deploying the updated development API and admin site. Keep control of Firebase, Render and their service-account credentials restricted to trusted operators. Repeat separately with the correct credentials and database when provisioning another environment.

1. In the **same development Firebase project used by the API**, enable Email/Password authentication and upgrade Authentication to **Identity Platform**. TOTP needs this upgrade; see [Firebase TOTP setup](https://firebase.google.com/docs/auth/web/totp-mfa). Add your actual admin hostname under Authentication → Settings → Authorized domains. Include the admin origin in the API's `ALLOWED_ORIGINS`.
2. Create one dedicated Email/Password user in Firebase Authentication → Users, using a mailbox you control and a unique strong password. If your new admin identity already exists, use it. Do not register it as a customer/pro on Aplime. The application and setup tool never create admin identities automatically.
3. Copy this user's **UID** into the development API backend group's `ADMIN_ALLOWED_UIDS`. For several approved administrators, use comma-separated UIDs. Save and redeploy the API. This value is not an email address, password or API key. Do not put it in the frontend/common group.
4. Sign in on your development **admin website**. If the email is unverified, the site shows **Send verification email** immediately. Follow the link in your inbox, then select **I verified my email**. The next screen explains owner approval and shows your account ID; no admin data loads. Sign out before the next step.
5. In Render → development **API service** → Shell, run the following with your actual admin email:

   ```sh
   npm run admin:setup -- your-admin-email@example.com --enable-totp
   ```

   `--enable-totp` explicitly authorizes enabling TOTP in this Firebase project if needed. The tool first checks the exact owner-approved UID, verified email, enabled Email/Password identity and database role. It preserves existing phone-MFA settings, confirms TOTP is enabled, then calls the existing audited provisioner to create the database admin record, issue `admin: true` and revoke old sessions. If TOTP is already enabled, it is not rewritten. The service account must have Firebase Auth user/claim permissions and project-config read/update permission for this operation. The command cannot upgrade the project to Identity Platform for you.

   Once project TOTP is enabled, additional provisioning needs only:

   ```sh
   npm run admin:setup -- your-admin-email@example.com
   ```

   A diagnostic check that changes no permissions or Firebase configuration:

   ```sh
   npm run admin:setup -- your-admin-email@example.com --check
   ```

   The check reports the found UID and the first missing prerequisite. It never grants access, and a passing check is not proof of successful sign-in. Do not pass passwords or secrets as command arguments.

6. Sign in on the admin website again. **Secure your account** guides you through adding the displayed setup key to an authenticator app and confirming a current six-digit code. The key is kept only in memory. Enrollment signs you out; sign in once more with your password and authenticator code. Only the API's independent authorization checks can return admin data.

Creating a Firebase user, verifying an email, resetting a password, knowing the admin URL or completing MFA does not itself grant admin access. There is no public registration, invitation or role-granting endpoint. Unapproved identities see only setup guidance. Existing customer/pro identities are refused by the operator tool. The original `npm run admin:access -- grant FIREBASE_UID` remains available for experienced operators; it does not enable project TOTP.

The admin app uses in-memory Firebase persistence: reloading/closing it requires signing in again. The API requires reauthentication after one hour even if the token has refreshed. Password recovery on the admin site uses Firebase's normal email reset; it does not remove MFA or change any roles. There is no default admin password or seeded administrator. Verification emails have a local resend cooldown, with Firebase enforcing its own limits.

## If sign-in still stops

- **Incorrect email/password:** ensure the admin site and API point to the same Firebase project. Use password reset; never share the password in logs or support messages.
- **Verify your email:** send the link from the admin site, follow it and check verification. Do not create a marketplace profile.
- **Owner approval required:** compare the displayed UID with `ADMIN_ALLOWED_UIDS`, then run the setup command in the correct API Shell. Sign out and back in after provisioning so revoked/stale tokens are replaced.
- **TOTP is not enabled / operation not allowed:** check Identity Platform activation and the service account's project-config permissions. The setup command needs `--enable-totp` to make this project-level change.
- **API access denied after MFA:** check the UID allowlist, boolean claim, database admin role and authentication age. No client button bypasses these checks.

## Revoke access and recover MFA

```sh
npm run admin:access -- revoke FIREBASE_UID
```

Remove the UID from `ADMIN_ALLOWED_UIDS` too and redeploy the API. Revocation clears the Firebase claim and revokes refresh tokens; existing ID tokens are checked for revocation by the API. Keep the database record for audit history. For a compromised identity, also disable it in Firebase.

Lost authenticator recovery is an operator process: revoke access, verify the administrator's identity outside the app, reset the enrolled factor through trusted Firebase administration, then repeat provisioning/enrollment. There is no public MFA-bypass endpoint.

## Hosting and validation

The admin static site links only the common group. Its build receives no backend group credentials and explicitly bundles only API_URL and APP_ENV; automatic VITE-prefixed environment exposure is disabled. Do not copy private credentials into client source or public configuration. Authorize the admin domain in Firebase and include it in API `ALLOWED_ORIGINS`.

Automated tests exercise allowlist, role, claim, identity, MFA and session-age denial paths. Actual Firebase/Identity Platform enrollment, revoked-token behavior and two-device sign-in must also be tested with configured service accounts before public launch.
