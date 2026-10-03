import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, CheckCircle2 } from "lucide-react";
import {
  imageError,
  MAX_PROJECT_IMAGES,
  IMAGE_TYPES,
} from "../shared/uploads.js";
import { request } from "./api.js";
export type ProjectPhoto = {
  key: string;
  file: File;
  preview: string;
  uploadId?: string;
  done?: boolean;
};
export async function sendProjectPhoto(projectId: string, photo: ProjectPhoto) {
  if (photo.done) return;
  const reservation = photo.uploadId
    ? await request(`/uploads/${photo.uploadId}/retry`, {})
    : await request(`/projects/${projectId}/uploads`, {
        name: photo.file.name,
        contentType: photo.file.type,
        size: photo.file.size,
      });
  photo.uploadId = reservation.id;
  if (!reservation.ready) {
    const result = await fetch(reservation.url, {
      method: "PUT",
      headers: { "Content-Type": photo.file.type },
      body: photo.file,
      signal: AbortSignal.timeout(120000),
    });
    if (!result.ok)
      throw new Error("Image upload failed. Check your connection and retry.");
    await request(`/uploads/${photo.uploadId}/complete`, {});
  }
  photo.done = true;
}
export function ProjectPhotos({
  photos,
  onChange,
  disabled,
}: {
  photos: ProjectPhoto[];
  onChange: (photos: ProjectPhoto[]) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const previews = useRef(new Set<string>());
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function add(files: File[]) {
    if (disabled) return;
    if (photos.length + files.length > MAX_PROJECT_IMAGES) {
      setError(
        "You can add up to 5 images. Remove an image before adding more.",
      );
      return;
    }
    const invalid = files.map((file) => imageError(file)).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    const additions = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: crypto.randomUUID(), file, preview };
    });
    onChange([...photos, ...additions]);
    setError("");
  }
  return (
    <section className="project-photos" aria-labelledby="project-photos-title">
      <div className="photo-heading">
        <div>
          <h3 id="project-photos-title">
            3. Add photos <small>(optional)</small>
          </h3>
          <p>Show the area and any details a professional should see.</p>
        </div>
        <strong aria-live="polite">{photos.length} / 5</strong>
      </div>
      <div
        className="photo-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(Array.from(e.dataTransfer.files));
        }}
      >
        <ImagePlus size={28} aria-hidden="true" />
        <label htmlFor="project-images">Choose photos or drag them here</label>
        <input
          id="project-images"
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          disabled={disabled || photos.length >= MAX_PROJECT_IMAGES}
          aria-describedby="photo-help photo-errors"
          onChange={(e) => {
            add(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <p id="photo-help">
          Up to 5 images · JPG, PNG, WebP · 10 MB each. Avoid personal documents
          and sensitive information.
        </p>
      </div>
      <p id="photo-errors" role="alert" className="photo-error">
        {error}
      </p>
      <div className="photo-grid">
        {photos.map((photo) => (
          <figure key={photo.key}>
            <img
              src={photo.preview}
              alt={`Project attachment: ${photo.file.name}`}
            />
            <figcaption>
              <strong title={photo.file.name}>{photo.file.name}</strong>
              <small>
                {(photo.file.size / 1024 / 1024).toFixed(1)} MB{" "}
                {photo.done && (
                  <>
                    <CheckCircle2 size={14} /> Uploaded
                  </>
                )}
              </small>
            </figcaption>
            {!disabled && (
              <button
                type="button"
                className="photo-remove"
                aria-label={`Remove ${photo.file.name}`}
                onClick={() => {
                  URL.revokeObjectURL(photo.preview);
                  previews.current.delete(photo.preview);
                  onChange(photos.filter((p) => p.key !== photo.key));
                  setError("");
                }}
              >
                <X size={16} />
              </button>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
