import { useEffect, useRef, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export function IntakeAccountNotice({ onSignOut }: { onSignOut: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!dismissed && !dialog.current?.open) dialog.current?.showModal();
  }, [dismissed]);
  return (
    <dialog
      ref={dialog}
      className="intake-account-dialog"
      aria-labelledby="intake-account-title"
      aria-describedby="intake-account-description"
      onClose={() => setDismissed(true)}
    >
      <button
        type="button"
        className="secondary intake-dialog-close"
        aria-label="Close message"
        onClick={() => dialog.current?.close()}
      >
        <X size={20} />
      </button>
      <div className="intake-dialog-icon">
        <ShieldAlert size={30} />
      </div>
      <h2 id="intake-account-title">
        Use a customer account to post your project
      </h2>
      <p id="intake-account-description">
        You signed in with a professional account. Your unfinished project is
        still saved in this browser tab, including your answers and selected
        photos.
      </p>
      <p>
        Sign out, then sign in or create a customer account to review and
        publish it.
      </p>
      <div className="intake-dialog-actions">
        <button type="button" onClick={onSignOut}>
          Sign out &amp; use a customer account
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => dialog.current?.close()}
        >
          Stay in my professional account
        </button>
      </div>
    </dialog>
  );
}
