import { useEffect, useRef, useState } from "react";
import { Images, Expand, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  portfolioImages,
  type BusinessImage,
} from "../shared/business-images.js";

export function BusinessPortfolio({
  images,
  business,
}: {
  images?: BusinessImage[];
  business: string;
}) {
  const photos = portfolioImages(images);
  const [viewId, setViewId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const index = photos.findIndex((photo) => photo.id === viewId);
  const current = photos[index];
  useEffect(() => {
    if (viewId && !current) setViewId(null);
    else if (viewId && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [viewId, current?.id]);
  const open = (id: string, button: HTMLButtonElement) => {
    opener.current = button;
    setViewId(id);
  };
  const move = (step: number) =>
    setViewId(photos[(index + step + photos.length) % photos.length].id);
  const label = (i: number) => `${business} · Past work photo ${i + 1}`;
  return (
    <section
      className="profile-content-card business-work-section"
      aria-label="Past work portfolio"
    >
      <div className="business-work-heading">
        <div>
          <p className="eyebrow">
            <Images size={16} aria-hidden="true" /> THEIR WORK, UP CLOSE
          </p>
          <h2>
            Past work{" "}
            <span>
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </span>
          </h2>
        </div>
        {!!photos.length && (
          <button
            type="button"
            className="secondary"
            onClick={(e) => open(photos[0].id, e.currentTarget)}
          >
            <Expand size={17} aria-hidden="true" /> View all photos
          </button>
        )}
      </div>
      {photos.length ? (
        <div
          className="business-work-mosaic"
          data-count={Math.min(photos.length, 5)}
        >
          {photos.slice(0, 5).map((photo, i) => (
            <button
              type="button"
              key={photo.id}
              className="business-work-tile"
              onClick={(e) => open(photo.id, e.currentTarget)}
              aria-label={`View ${label(i)}${i === 4 && photos.length > 5 ? `; ${photos.length - 5} more photos in the gallery` : ""}`}
            >
              <img
                src={photo.url}
                alt={`${business} past work photo ${i + 1}`}
                loading="lazy"
                decoding="async"
              />
              <span className="business-work-photo-label">
                <Expand size={15} aria-hidden="true" />{" "}
                {i === 4 && photos.length > 5
                  ? `+${photos.length - 5} more photos`
                  : `Photo ${i + 1}`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="business-work-empty">
          This business hasn’t published past-work photos yet.
        </p>
      )}
      {current && (
        <dialog
          ref={dialog}
          className="business-image-dialog business-work-dialog"
          aria-labelledby="business-work-viewer-title"
          onClose={() => {
            setViewId(null);
            opener.current?.focus();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
          onKeyDown={(e) => {
            if (
              photos.length > 1 &&
              (e.key === "ArrowLeft" || e.key === "ArrowRight")
            ) {
              e.preventDefault();
              move(e.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <div className="business-image-heading">
            <div>
              <h2 id="business-work-viewer-title">{business} · Past work</h2>
              <p aria-live="polite">
                Photo {index + 1} of {photos.length}
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              aria-label="Close portfolio viewer"
              onClick={() => dialog.current?.close()}
              autoFocus
            >
              <X size={18} /> Close
            </button>
          </div>
          <div className="business-work-stage">
            <img src={current.url} alt={label(index)} />
          </div>
          {photos.length > 1 && (
            <>
              <div className="business-work-navigation">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => move(-1)}
                  aria-label="Previous portfolio photo"
                >
                  <ChevronLeft size={20} /> Previous
                </button>
                <span>
                  {index + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => move(1)}
                  aria-label="Next portfolio photo"
                >
                  Next <ChevronRight size={20} />
                </button>
              </div>
              <div
                className="business-work-thumbnails"
                aria-label="Choose a portfolio photo"
              >
                {photos.map((photo, i) => (
                  <button
                    type="button"
                    key={photo.id}
                    aria-label={`Show past work photo ${i + 1}`}
                    aria-current={photo.id === viewId ? "true" : undefined}
                    onClick={() => setViewId(photo.id)}
                  >
                    <img src={photo.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </>
          )}
        </dialog>
      )}
    </section>
  );
}
