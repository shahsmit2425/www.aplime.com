import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { fallbackConfig } from "../shared/config.js";
export function auth() {
  const c = window.__CONFIG__ || fallbackConfig;
  if (!c.firebase.apiKey) throw new Error("Sign-in is not configured yet.");
  return getAuth(getApps()[0] || initializeApp(c.firebase));
}
export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth(), email, password);
}
export async function register(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth(), email, password);
  await sendEmailVerification(result.user);
  return result;
}
export async function google() {
  if (!Capacitor.isNativePlatform())
    return signInWithPopup(auth(), new GoogleAuthProvider());
  const r = await FirebaseAuthentication.signInWithGoogle();
  return signInWithCredential(
    auth(),
    GoogleAuthProvider.credential(r.credential?.idToken),
  );
}
export async function apple() {
  if (!Capacitor.isNativePlatform())
    return signInWithPopup(auth(), new OAuthProvider("apple.com"));
  const r = await FirebaseAuthentication.signInWithApple();
  return signInWithCredential(
    auth(),
    new OAuthProvider("apple.com").credential({
      idToken: r.credential?.idToken,
      rawNonce: r.credential?.nonce,
    }),
  );
}
export async function logout() {
  await signOut(auth());
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
}
export async function recover(email: string) {
  await sendPasswordResetEmail(auth(), email);
}
export async function verifyEmail(user: User) {
  await sendEmailVerification(user);
}

export function authErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

export function authErrorMessage(error: unknown) {
  switch (authErrorCode(error)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect. Try again or reset your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 12 characters.";
    case "auth/too-many-requests":
      return "Too many attempts were made. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "We could not reach the sign-in service. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before authentication finished.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses another sign-in method. Sign in using the original method.";
    default:
      return error instanceof Error ? error.message : "Authentication could not be completed.";
  }
}
