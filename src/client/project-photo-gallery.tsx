import { useEffect, useState, type ReactNode } from "react";
import { Eye, ImageOff, RefreshCw } from "lucide-react";
import type { Upload } from "../shared/domain.js";
import { request } from "./api.js";
import { ImagePreview } from "./image-preview.js";
export function SavedPhoto({
  file,
  onView,
  tools,
}: {
  file: Upload;
  onView: (image: { url: string; name: string }) => void;
  tools?: ReactNode;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [opening, setOpening] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl("");
    setError("");
    void request<{ url: string }>("/uploads/" + file.id)
      .then((r) => {
        if (active) setUrl(r.url);
      })
      .catch(() => {
        if (active) setError("This photo could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [file.id, attempt]);
  const view = async () => {
    setOpening(true);
    try {
      const result = await request<{ url: string }>("/uploads/" + file.id);
      onView({ url: result.url, name: file.name });
    } catch {
      setError("Could not open this photo. Please retry.");
    } finally {
      setOpening(false);
    }
  };
  return (
    <figure className="project-saved-photo">
      <button
        type="button"
        className="project-photo-thumbnail"
        aria-label={"View " + file.name}
        disabled={!url || !!error || opening}
        onClick={() => void view()}
      >
        {error ? (
          <span>
            <ImageOff size={24} />
            Photo unavailable
          </span>
        ) : url ? (
          <img
            src={url}
            alt={file.name}
            loading="lazy"
            onError={() => setError("This photo could not be loaded.")}
          />
        ) : (
          <span role="status">Loading photo…</span>
        )}
      </button>
      <figcaption>
        <strong title={file.name}>{file.name}</strong>
        <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
      </figcaption>
      {error ? (
        <>
          <p role="status">{error}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </>
      ) : (
        <button
          type="button"
          className="secondary"
          disabled={!url || opening}
          onClick={() => void view()}
        >
          <Eye size={14} />
          {opening ? "Opening…" : "View photo"}
        </button>
      )}
      {tools}
    </figure>
  );
}
export function ProjectPhotoGallery({ files }: { files: Upload[] }) {
  const [view, setView] = useState<{ url: string; name: string } | null>(null);
  if (!files.length) return null;
  return (
    <section className="panel project-photo-panel" aria-label="Project photos">
      <div className="project-section-heading">
        <h2>Project photos</h2>
        <span>
          {files.length} {files.length === 1 ? "photo" : "photos"}
        </span>
      </div>
      <div className="project-photo-gallery">
        {files.map((file) => (
          <SavedPhoto key={file.id} file={file} onView={setView} />
        ))}
      </div>
      {view && <ImagePreview image={view} onClose={() => setView(null)} />}
    </section>
  );
}
