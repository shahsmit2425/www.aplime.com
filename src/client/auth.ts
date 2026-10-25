import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { fallbackConfig } from "../shared/config.js";
import { createOrResume } from "./registration.js";
export async function configureSession(remember: boolean) {
  await setPersistence(
    auth(),
    remember || Capacitor.isNativePlatform()
      ? browserLocalPersistence
      : browserSessionPersistence,
  );
}
export function auth() {
  const c = window.__CONFIG__ || fallbackConfig;
  if (!c.firebase.apiKey) throw new Error("Sign-in is not configured yet.");
  return getAuth(getApps()[0] || initializeApp(c.firebase));
}
export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth(), email, password);
}
export async function register(email: string, password: string) {
  const { credential, created } = await createOrResume(
    () => createUserWithEmailAndPassword(auth(), email.trim(), password),
    () => login(email.trim(), password),
  );
  if (created) await sendEmailVerification(credential.user);
  return credential;
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
export async function logout() {
  await signOut(auth());
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
}
export function usesPassword() {
  return auth().currentUser?.providerData.some(
    (p) => p.providerId === "password",
  );
}
export async function reauthenticate(password?: string) {
  const user = auth().currentUser;
  if (!user) throw new Error("Please sign in again.");
  const provider = user.providerData[0]?.providerId;
  if (provider === "password") {
    if (!password) throw new Error("Enter your password to continue.");
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email || "", password),
    );
  } else if (provider === "google.com") {
    if (!Capacitor.isNativePlatform()) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      const r = await FirebaseAuthentication.signInWithGoogle();
      await reauthenticateWithCredential(
        user,
        GoogleAuthProvider.credential(r.credential?.idToken),
      );
    }
  } else throw new Error("Sign out and sign in again, then retry.");
  await user.getIdToken(true);
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
      return error instanceof Error
        ? error.message
        : "Authentication could not be completed.";
  }
}
