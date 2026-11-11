export type AdminLoginStep =
  "sign_in" | "verify_email" | "approval" | "recover";

// Presentation only. Backend UID/role/claim/TOTP/session checks remain authoritative.
export function adminLoginDestination(
  emailVerified: boolean,
  claim: unknown,
  enrolledTotp: boolean,
) {
  if (!emailVerified) return "verify_email";
  if (claim !== true) return "approval";
  return enrolledTotp ? "workspace" : "enroll";
}
export async function requestAdminPasswordReset(send: () => Promise<void>) {
  try {
    await send();
  } catch (error) {
    // Keep recovery generic on older projects without enumeration protection.
    if (!(
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ))
      throw error;
  }
}
export function adminAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect. Check your details or reset your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes before trying again.";
    case "auth/network-request-failed":
      return "We could not reach sign-in. Check your connection and try again.";
    case "auth/invalid-verification-code":
      return "That authenticator code was not accepted. Enter the current six-digit code.";
    case "auth/invalid-session-info":
    case "auth/multi-factor-info-not-found":
      return "This sign-in session has changed. Sign out and start again.";
    case "auth/operation-not-allowed":
      return "This sign-in step is not enabled. The owner needs to check Email/Password and Identity Platform TOTP configuration.";
    case "auth/user-token-expired":
    case "auth/invalid-user-token":
      return "Your access settings or session changed. Sign out and sign in again.";
    default:
      return code
        ? "Sign-in could not complete. Try again or ask the owner to check authentication setup."
        : error instanceof Error
          ? error.message
          : "Sign-in could not complete.";
  }
}
