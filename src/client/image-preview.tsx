import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function ImagePreview({
  image,
  onClose,
}: {
  image: { url: string; name: string };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="business-image-dialog project-image-dialog"
      aria-label={image.name + " preview"}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="business-image-heading">
        <h2>{image.name}</h2>
        <button
          type="button"
          className="secondary"
          aria-label="Close image preview"
          onClick={onClose}
          autoFocus
        >
          <X size={18} />
          Close
        </button>
      </div>
      <img src={image.url} alt={image.name} />
    </dialog>
  );
}
