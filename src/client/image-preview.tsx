import { T } from "../shared/language.js";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ZoomableImage } from "./zoomable-image.js";
export function ImagePreview({
  image,
  onClose,
  position,
  onMove,
}: {
  image: { url: string; name: string };
  onClose: () => void;
  // "2 / 4" and previous/next when the photo belongs to a set.
  position?: { index: number; total: number };
  onMove?: (step: number) => void;
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
      onKeyDown={(e) => {
        if (!onMove) return;
        if (e.key === "ArrowLeft") onMove(-1);
        if (e.key === "ArrowRight") onMove(1);
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
          <T>{"Close"}</T>{" "}
        </button>
      </div>
      <ZoomableImage key={image.url} src={image.url} alt={image.name} />
      {position && onMove && position.total > 1 && (
        <div className="business-work-navigation project-image-navigation">
          <button
            type="button"
            className="secondary"
            onClick={() => onMove(-1)}
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} /> Previous
          </button>
          <span>
            {position.index + 1} / {position.total}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => onMove(1)}
            aria-label="Next photo"
          >
            <T>{"Next"}</T> <ChevronRight size={20} />
          </button>
        </div>
      )}
    </dialog>
  );
}
