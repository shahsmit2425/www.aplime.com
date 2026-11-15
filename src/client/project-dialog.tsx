import { useWorkspace } from "./workspace.js";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function ProjectDialog({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { actionError } = useWorkspace();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="project-management-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="project-dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} /> Close
        </button>
      </div>
      {actionError && (
        <p role="alert" className="project-dialog-error">
          {actionError}
        </p>
      )}
      {children}
    </dialog>
  );
}
