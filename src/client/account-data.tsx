import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { request } from "./api.js";
import {
  reauthenticate,
  usesPassword,
  logout,
  changePassword,
} from "./auth.js";
import { Field, Form, Panel } from "./ui.js";
import { useWorkspace } from "./workspace.js";

// Sensitive actions need a sign-in from the last few minutes.
async function confirm(f: FormData) {
  await reauthenticate(String(f.get("password") || ""));
}
function ConfirmPassword() {
  return usesPassword() ? (
    <Field label="Confirm your password">
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
    </Field>
  ) : null;
}

export function PasswordForm() {
  const { run, busy } = useWorkspace();
  const [passwordVersion, setPasswordVersion] = useState(0);
  return (
    <Panel title="Password">
      {usesPassword() ? (
        <Form
          key={passwordVersion}
          busy={busy}
          onSubmit={(f) =>
            run(async () => {
              await changePassword(
                String(f.get("currentPassword") || ""),
                String(f.get("newPassword") || ""),
                String(f.get("confirmPassword") || ""),
              );
              setPasswordVersion((value) => value + 1);
            }, "Your password has been updated.")
          }
        >
          <Field label="Current password">
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password">
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </Field>
          <p>
            Use at least 12 characters and a password you do not use elsewhere.
          </p>
          <button>Update password</button>
        </Form>
      ) : (
        <p>
          You sign in with Google. Manage your password in your Google account.
        </p>
      )}
    </Panel>
  );
}

export function Sessions() {
  const { run, busy, go } = useWorkspace();
  return (
    <Panel title="Sign out all devices">
      <p>
        Signs your account out everywhere, including this device. Use this if
        you lost a device or think someone else has access.
      </p>
      <Form
        busy={busy}
        onSubmit={(f) =>
          run(
            async () => {
              await confirm(f);
              await request("/account/revoke-sessions", {});
              await logout().catch(() => {});
            },
            "All devices have been signed out.",
            () => go("login"),
          )
        }
      >
        <ConfirmPassword />
        <button className="secondary">Sign out all devices</button>
      </Form>
    </Panel>
  );
}

export function DataExport() {
  const { run, busy } = useWorkspace();
  // Saving a file from the native apps has not been built.
  if (Capacitor.isNativePlatform()) return null;
  return (
    <Panel title="Download your data">
      <p>
        Download a copy of the personal data Aplime holds for your account as a
        JSON file. Messages are limited to those you sent, and payment card
        details are held by Stripe and are not included.
      </p>
      <Form
        busy={busy}
        onSubmit={(f) =>
          run(async () => {
            await confirm(f);
            const data = await request("/account/export");
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "aplime-account-data.json";
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          }, "Your data download has started.")
        }
      >
        <ConfirmPassword />
        <button className="secondary">Download my data</button>
      </Form>
    </Panel>
  );
}

export function AccountClosure() {
  const { run, busy, go } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="panel settings-danger">
      <h2>Delete account</h2>
      <p>
        Deleting removes your sign-in, profile, photos, saved items and
        notifications and cannot be undone. Open projects you created are
        cancelled. Projects you share with another person, payment and support
        records, and messages you sent in conversations are kept for the other
        participant and for legal and dispute purposes, shown under the name
        “Deleted user”. You must first finish, cancel or resolve active projects{" "}
        and cancel any paid membership.
      </p>
      {confirming ? (
        <Form
          busy={busy}
          onSubmit={(f) =>
            run(
              async () => {
                if (f.get("confirm") !== "DELETE")
                  throw new Error("Type DELETE to confirm.");
                await confirm(f);
                await request("/account/delete", { confirm: "DELETE" });
                await logout().catch(() => {});
              },
              "Your account was deleted.",
              () => go("login"),
            )
          }
        >
          <Field label="Type DELETE to confirm">
            <input name="confirm" autoComplete="off" required />
          </Field>
          <ConfirmPassword />
          <button className="danger">Permanently delete my account</button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirming(false)}
          >
            Keep my account
          </button>
        </Form>
      ) : (
        <button className="danger" onClick={() => setConfirming(true)}>
          Delete my account…
        </button>
      )}
    </section>
  );
}
