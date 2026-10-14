import { useState } from "react";
import { request } from "./api.js";
import { reauthenticate, usesPassword, logout } from "./auth.js";
import { Field, Form, Panel } from "./ui.js";
import { useWorkspace } from "./workspace.js";

export function AccountData() {
  const { run, busy, go } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const password = usesPassword();
  async function confirm(f: FormData) {
    await reauthenticate(String(f.get("password") || ""));
  }
  return (
    <Panel title="Download or delete your data">
      <p>
        Download a copy of the personal data we hold for your account, or
        permanently delete your account. Both ask you to confirm your sign-in
        first.
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
        <button className="secondary">Download my data</button>
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
