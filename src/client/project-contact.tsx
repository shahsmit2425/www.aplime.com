import { useEffect, useState } from "react";
import { request } from "./api.js";
import { PhoneSharingChoice } from "./phone-sharing-choice.js";
import { T } from "../shared/language.js";
type Contact = {
  phone?: string;
  available?: boolean;
  consentAt?: string | null;
};

export function ProjectContact({ projectId }: { projectId: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/projects/${projectId}/contact`;
  useEffect(() => {
    let active = true;
    request<Contact | null>(path + "?preview=1")
      .then((result) => {
        if (active) setContact(result);
      })
      .catch(() => {
        if (active) setError("Could not load project contact details.");
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function reveal() {
    setBusy(true);
    setError("");
    try {
      setContact(await request<Contact>(path + "/reveal", {}, "POST"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reveal the phone number.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeSharing(sharePhone: boolean) {
    setBusy(true);
    setError("");
    try {
      setContact(await request<Contact>(path, { sharePhone }, "PATCH"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not update your sharing preference.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!contact && !error) return null;
  return (
    <section className="project-contact-card">
      <strong>
        <T>Project contact</T>
      </strong>
      {contact?.phone ? (
        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
      ) : (
        contact?.available && (
          <button type="button" disabled={busy} onClick={reveal}>
            {busy ? "Loading…" : "Show phone number"}
          </button>
        )
      )}
      {error && <span role="alert">{error}</span>}
      {contact && "consentAt" in contact ? (
        <PhoneSharingChoice
          value={!!contact.consentAt}
          onChange={changeSharing}
          disabled={busy}
        />
      ) : (
        contact && (
          <small>
            <T>Customer permission: calls or texts about this project only.</T>
          </small>
        )
      )}
    </section>
  );
}
