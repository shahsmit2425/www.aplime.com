import { useState } from "react";
import { request } from "./api.js";
import {
  reauthenticate,
  usesPassword,
  logout,
  changePassword,
} from "./auth.js";
import { Field, Form, Panel } from "./ui.js";
import { useWorkspace } from "./workspace.js";

export function AccountData() {
  const { run, busy, go } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const password = usesPassword();
  const [passwordVersion, setPasswordVersion] = useState(0);
  async function confirm(f: FormData) {
    await reauthenticate(String(f.get("password") || ""));
  }
  return (
    <Panel title="Account security">
      <h3>Update password</h3>
      {password ? (
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
      <h3>Sign out all devices</h3>
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
        {password && (
          <Field label="Confirm your password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        )}
        <button className="secondary">Sign out all devices</button>
      </Form>
      <h3>Delete account</h3>
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
          {password && (
            <Field label="Confirm your password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          )}
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
    </Panel>
  );
}
