import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { feedbackPage } from "../shared/feedback.js";
import { fallbackConfig } from "../shared/config.js";
import { MomentArt } from "./moments.js";

export default function WebsiteFeedback() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submissionId = useRef("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else {
      dialog.current?.close();
    }
  }, [open]);
  function close() {
    if (!busy) {
      setOpen(false);
      trigger.current?.focus();
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="website-feedback-trigger"
        onClick={() => {
          if (sent || !submissionId.current)
            submissionId.current = crypto.randomUUID();
          setSent(false);
          setError("");
          setOpen(true);
        }}
      >
        <MessageSquare size={18} /> Feedback
      </button>
      <dialog
        ref={dialog}
        className="website-feedback-dialog"
        aria-labelledby="website-feedback-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="website-feedback-heading">
          <h2 id="website-feedback-title">Share website feedback</h2>
          <button
            type="button"
            className="secondary"
            aria-label="Close feedback"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {sent ? (
          <div role="status" className="feedback-thanks">
            <MomentArt kind="thanks" size={34} />
            <p>Thank you! Your feedback has been sent to the Aplime team.</p>
            <button type="button" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = e.currentTarget;
              const values = new FormData(form);
              setBusy(true);
              setError("");
              try {
                const response = await fetch(
                  (window.__CONFIG__ || fallbackConfig).apiUrl +
                    "/api/feedback",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "omit",
                    signal: AbortSignal.timeout(20000),
                    body: JSON.stringify({
                      id: submissionId.current,
                      category: values.get("category"),
                      message: values.get("message"),
                      email: values.get("email"),
                      website: values.get("website"),
                      page: feedbackPage(location.pathname, location.hash),
                    }),
                  },
                );
                if (!response.ok)
                  throw new Error(
                    response.status === 429
                      ? "Too many submissions. Please try again later."
                      : response.status === 503
                        ? "Feedback is temporarily unavailable. Please try again later."
                        : "Could not send feedback. Please check your message and try again.",
                  );
                setSent(true);
                form.reset();
              } catch (err) {
                setError(
                  err instanceof Error &&
                    err.name !== "TimeoutError" &&
                    err.name !== "TypeError"
                    ? err.message
                    : "Could not connect. Please try again. Your message is still here.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>No account needed. For help with a project, use Support.</p>
            <fieldset disabled={busy}>
              <label>
                Feedback type
                <select name="category">
                  <option value="suggestion">Suggestion</option>
                  <option value="problem">Report a website problem</option>
                  <option value="other">Other feedback</option>
                </select>
              </label>
              <label>
                Your feedback
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  aria-describedby="feedback-help"
                />
              </label>
              <small id="feedback-help">
                10–2,000 characters. Don’t include passwords, payment details or
                private project information.
              </small>
              <label>
                Email (optional)
                <input
                  type="email"
                  name="email"
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <small>
                Only if you’d like a follow-up. We also record the general page
                category.
              </small>
              <label className="feedback-bot-trap" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              {error && <p role="alert">{error}</p>}
              <button type="submit">
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </fieldset>
          </form>
        )}
      </dialog>
    </>
  );
}
