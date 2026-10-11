import type { Upload as SavedUpload } from "../shared/domain.js";
import { SavedPhoto } from "./project-photo-gallery.js";
import { ImagePreview } from "./image-preview.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Upload,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  imageError,
  MAX_PROJECT_IMAGES,
  IMAGE_TYPES,
} from "../shared/uploads.js";
import { request, uploadImageContent } from "./api.js";
export type ProjectPhoto = {
  key: string;
  file: File;
  preview: string;
  uploadId?: string;
  done?: boolean;
};
async function transferProjectPhoto(projectId: string, photo: ProjectPhoto) {
  if (!photo.uploadId) {
    const reservation = await request(
      `/projects/${projectId}/photos/reservations`,
      {
        name: photo.file.name,
        contentType: photo.file.type,
        size: photo.file.size,
      },
    );
    photo.uploadId = reservation.id;
  }
  await uploadImageContent(
    `/project-photos/${photo.uploadId}/content`,
    photo.file,
    AbortSignal.timeout(120000),
  );
}
export async function sendProjectPhoto(projectId: string, photo: ProjectPhoto) {
  if (photo.done) return;
  await transferProjectPhoto(projectId, photo);
  await request(`/uploads/${photo.uploadId}/complete`, {});
  photo.done = true;
}
export async function stageProjectPhoto(
  projectId: string,
  photo: ProjectPhoto,
) {
  if (photo.done) return;
  await transferProjectPhoto(projectId, photo);
  photo.done = true;
}
// The project form owns previews so review/back navigation keeps them alive.
export function useProjectPhotos(cleanupPending = false) {
  const current = useRef<ProjectPhoto[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const urls = useRef(new Set<string>());
  const update = useCallback(
    (next: ProjectPhoto[]) => {
      if (cleanupPending)
        for (const photo of current.current) {
          if (photo.uploadId && !next.includes(photo))
            void request(
              `/uploads/${photo.uploadId}`,
              undefined,
              "DELETE",
            ).catch(() => {});
        }
      current.current = next;
      const keep = new Set(next.map((photo) => photo.preview));
      urls.current.forEach((url) => {
        if (!keep.has(url)) URL.revokeObjectURL(url);
      });
      urls.current = keep;
      setPhotos(next);
    },
    [cleanupPending],
  );
  useEffect(
    () => () => {
      if (cleanupPending)
        for (const photo of current.current) {
          if (photo.uploadId)
            void request(
              `/uploads/${photo.uploadId}`,
              undefined,
              "DELETE",
            ).catch(() => {});
        }
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [cleanupPending],
  );
  return [photos, update] as const;
}
export function ProjectPhotos({
  photos,
  onChange,
  disabled,
  existing = [],
  readOnlyIds = [],
  onExistingChange,
  editing = false,
}: {
  existing?: SavedUpload[];
  readOnlyIds?: string[];
  onExistingChange?: (files: SavedUpload[]) => void;
  editing?: boolean;
  photos: ProjectPhoto[];
  onChange: (photos: ProjectPhoto[]) => void;
  disabled: boolean;
}) {
  const count = photos.length + existing.length;
  const [error, setError] = useState("");
  const [view, setView] = useState<{ url: string; name: string } | null>(null);
  const inputId = useRef("project-images-" + crypto.randomUUID()).current;
  function select(files: File[], replaceKey?: string) {
    if (disabled || !files.length) return;
    if (replaceKey && files.length !== 1) {
      setError("Choose one image to replace this photo.");
      return;
    }
    if (!replaceKey && count + files.length > MAX_PROJECT_IMAGES) {
      setError(
        "You can add up to 5 images. Replace or remove a photo before adding more.",
      );
      return;
    }
    const problem = files.map(imageError).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    const additions = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    const savedReplacement = existing.some((file) => file.id === replaceKey);
    if (savedReplacement)
      onExistingChange?.(existing.filter((file) => file.id !== replaceKey));
    onChange(
      savedReplacement
        ? [...photos, additions[0]]
        : replaceKey
          ? photos.map((photo) =>
              photo.key === replaceKey ? additions[0] : photo,
            )
          : [...photos, ...additions],
    );
    setError("");
    setView(null);
  }
  return (
    <section
      className="project-photos project-photo-editor"
      aria-labelledby="project-photos-title"
    >
      <div className="photo-heading">
        <div>
          <h3 id="project-photos-title">
            {editing ? "Project photos" : "3. Add photos"}{" "}
            <small>(optional)</small>
          </h3>
          <p>
            {editing
              ? "View, replace, remove or add photos. Changes apply when you save."
              : "Preview, replace or remove photos before publishing."}
          </p>
        </div>
        <strong aria-live="polite">
          {count} / {MAX_PROJECT_IMAGES}
        </strong>
      </div>
      <div
        className="photo-dropzone project-photo-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          select(Array.from(e.dataTransfer.files));
        }}
      >
        <ImagePlus size={30} aria-hidden="true" />
        <div>
          <strong>Add photos of your project</strong>
          <p>JPG, PNG or WebP · up to 10 MB each · maximum 5 photos</p>
        </div>
        <label className="business-image-picker project-photo-picker">
          <Upload size={16} />
          {count >= MAX_PROJECT_IMAGES ? "5 photos selected" : "Choose photos"}
          <input
            id={inputId}
            aria-label="Choose project photos"
            type="file"
            multiple
            accept={IMAGE_TYPES.join(",")}
            disabled={disabled || count >= MAX_PROJECT_IMAGES}
            onChange={(e) => {
              select(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="project-photo-publish-note">
        {editing
          ? "Your existing photos stay unchanged until Save changes succeeds."
          : "Photos upload when you publish your project."}
      </p>
      {error && (
        <p role="alert" className="photo-error">
          {error}
        </p>
      )}
      <div className="project-photo-selection-grid">
        {existing.map((file) => (
          <SavedPhoto
            key={file.id}
            file={file}
            onView={setView}
            tools={
              readOnlyIds.includes(file.id) ? (
                <small>Added by your professional</small>
              ) : (
                <div className="actions">
                  <label className="business-image-picker">
                    <RefreshCw size={15} /> Replace
                    <input
                      type="file"
                      aria-label={"Replace " + file.name}
                      accept={IMAGE_TYPES.join(",")}
                      disabled={disabled}
                      onChange={(e) => {
                        select(Array.from(e.target.files || []), file.id);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button project-photo-remove"
                    disabled={disabled}
                    aria-label={"Remove " + file.name}
                    onClick={() => {
                      onExistingChange?.(
                        existing.filter((f) => f.id !== file.id),
                      );
                      setError("");
                    }}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              )
            }
          />
        ))}
        {photos.map((photo, index) => (
          <section
            className="business-media-slot project-photo-selection"
            key={photo.key}
            aria-label={"Project photo " + (index + 1)}
          >
            <button
              type="button"
              className="project-photo-thumbnail"
              aria-label={"Preview " + photo.file.name}
              onClick={() =>
                setView({ url: photo.preview, name: photo.file.name })
              }
            >
              <img
                src={photo.preview}
                alt={"Project photo " + (index + 1) + ": " + photo.file.name}
              />
            </button>
            <div className="business-image-heading">
              <strong>Photo {index + 1}</strong>
              <span className="business-image-status">
                {photo.done ? (
                  <>
                    <CheckCircle2 size={13} />
                    {editing ? "Uploaded · not saved" : "Uploaded"}
                  </>
                ) : editing ? (
                  "Ready to save"
                ) : (
                  "Ready to publish"
                )}
              </span>
            </div>
            <small className="business-file-name" title={photo.file.name}>
              {photo.file.name} · {(photo.file.size / 1024 / 1024).toFixed(2)}{" "}
              MB
            </small>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setView({ url: photo.preview, name: photo.file.name })
                }
              >
                <Eye size={15} />
                View
              </button>
              <label className="business-image-picker">
                <RefreshCw size={15} />
                Replace
                <input
                  aria-label={"Replace " + photo.file.name}
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  disabled={disabled}
                  onChange={(e) => {
                    select(Array.from(e.target.files || []), photo.key);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="text-button project-photo-remove"
                disabled={disabled}
                aria-label={"Remove " + photo.file.name}
                onClick={() => {
                  onChange(photos.filter((p) => p.key !== photo.key));
                  setError("");
                  setView(null);
                }}
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          </section>
        ))}
      </div>
      {view && <ImagePreview image={view} onClose={() => setView(null)} />}
    </section>
  );
}
