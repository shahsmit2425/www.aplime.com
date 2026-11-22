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
  const { run, busy, go } = useWorkspace();
  const [passwordVersion, setPasswordVersion] = useState(0);
  return (
    <Panel title="Password">
      {usesPassword() ? (
        <Form
          key={passwordVersion}
          busy={busy}
          onSubmit={(f) =>
            run(
              async () => {
                await changePassword(
                  String(f.get("currentPassword") || ""),
                  String(f.get("newPassword") || ""),
                  String(f.get("confirmPassword") || ""),
                );
                setPasswordVersion((value) => value + 1);
                try {
                  await request("/account/password-changed", {});
                } catch {
                  throw new Error(
                    "Your password was updated, but we could not sign you out. Use “Sign out all devices” below.",
                  );
                }
                await logout().catch(() => {});
              },
              "Password updated. Open the verification link we emailed you, then sign in with your new password.",
              () => go("login"),
            )
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
          <div className="settings-pair">
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
          </div>
          <ul className="settings-notes">
            <li>At least 12 characters.</li>
            <li>You will be signed out on every device.</li>
            <li>Verify your email from the link we send to sign in again.</li>
          </ul>
          <button>Update password</button>
        </Form>
      ) : (
        <p>You sign in with Google.</p>
      )}
    </Panel>
  );
}

export function Sessions() {
  const { run, busy, go } = useWorkspace();
  return (
    <Panel title="Sign out all devices">
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

export function AccountClosure() {
  const { run, busy, go } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="panel settings-danger">
      <h2>Delete account</h2>
      <ul className="settings-notes">
        <li>
          Permanently removes your sign-in, profile, photos and saved items, and
          cancels your open projects.
        </li>
        <li>
          Shared projects, payment and support records, and messages you sent
          stay under “Deleted user”.
        </li>
        <li>Finish or cancel active projects and any paid membership first.</li>
      </ul>
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
