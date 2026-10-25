import { useEffect, useState } from "react";
import { request, uploadImageContent } from "./api.js";
import { ImagePreview } from "./image-preview.js";
import { imageError } from "../shared/uploads.js";
import { T } from "../shared/language.js";
export type ReviewPhoto = { slot: number; url: string };
export function ReviewPhotoGallery({ photos }: { photos: ReviewPhoto[] }) {
  const [view, setView] = useState<ReviewPhoto | null>(null);
  return (
    <>
      <div className="review-photo-grid">
        {photos.map((p) => (
          <button
            type="button"
            className="review-photo-thumb"
            key={p.slot}
            onClick={() => setView(p)}
            aria-label={`View review photo ${p.slot}`}
          >
            <img
              src={p.url}
              loading="lazy"
              alt={`Customer review photo ${p.slot}`}
            />
          </button>
        ))}
      </div>
      {view && (
        <ImagePreview
          image={{ url: view.url, name: `Review photo ${view.slot}` }}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}
export function ReviewPhotoEditor({
  projectId,
  editable = false,
  onBusy,
}: {
  projectId: string;
  editable?: boolean;
  onBusy?: (value: boolean) => void;
}) {
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const path = `/projects/${projectId}/review-photos`;
  async function load() {
    setPhotos(await request<ReviewPhoto[]>(path));
  }
  useEffect(() => {
    let active = true;
    request<ReviewPhoto[]>(path)
      .then((p) => {
        if (active) setPhotos(p);
      })
      .catch(() => {
        if (active)
          setError("Photos could not be loaded. Refresh and try again.");
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function upload(files: File[], replace?: number) {
    setError("");
    if (!files.length) return;
    if (replace === undefined && photos.length + files.length > 10) {
      setError("You can add up to 10 review photos.");
      return;
    }
    const invalid = files.map(imageError).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    const available = Array.from({ length: 10 }, (_, i) => i + 1).filter(
      (n) => !photos.some((p) => p.slot === n),
    );
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadImageContent(
          `${path}/${replace ?? available[i]}`,
          files[i],
          AbortSignal.timeout(120000),
        );
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <section className="review-photo-editor">
      <h3>
        <T>Review photos</T> <small>{photos.length}/10</small>
      </h3>
      <ReviewPhotoGallery photos={photos} />
      {editable && (
        <>
          <p>
            <T>
              Optional: show the completed work. These photos become public with
              your review. Avoid people, addresses and private information.
            </T>
          </p>
          <div className="review-photo-actions">
            {photos.map((p) => (
              <div key={p.slot}>
                <span>{p.slot}</span>
                <label>
                  <T>Replace</T>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      void upload(
                        Array.from(e.target.files || []).slice(0, 1),
                        p.slot,
                      );
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    onBusy?.(true);
                    try {
                      await request(`${path}/${p.slot}`, undefined, "DELETE");
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                      onBusy?.(false);
                    }
                  }}
                >
                  <T>Remove</T>
                </button>
              </div>
            ))}
          </div>
          {photos.length < 10 && (
            <label className="review-photo-add">
              <T>Add photos</T>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void upload(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <small>JPG, PNG, WebP · 10 MB / photo</small>
        </>
      )}
      {busy && (
        <p role="status">
          <T>Saving photos…</T>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
