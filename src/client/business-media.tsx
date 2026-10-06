import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import type { Profile } from "../shared/domain.js";
import { businessImageSlots } from "../shared/business-images.js";
import { imageError, IMAGE_TYPES } from "../shared/uploads.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Panel } from "./ui.js";
export function BusinessMedia({ profile }: { profile?: Profile }) {
  const { run, busy } = useWorkspace();
  const [pending, setPending] = useState<{
      slot: string;
      file: File;
      preview: string;
    } | null>(null),
    [progress, setProgress] = useState("");
  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const clear = () => {
    if (pending) {
      URL.revokeObjectURL(pending.preview);
      urls.current.delete(pending.preview);
    }
    setPending(null);
    setProgress("");
  };
  const upload = (item: { slot: string; file: File; preview: string }) =>
    void run(async () => {
      setProgress("Uploading your business image…");
      try {
        const r = await request("/profile/images", {
          slot: item.slot,
          name: item.file.name,
          contentType: item.file.type,
          size: item.file.size,
        });
        const result = await fetch(r.url, {
          method: "PUT",
          headers: { "Content-Type": item.file.type },
          body: item.file,
          signal: AbortSignal.timeout(120000),
        });
        if (!result.ok)
          throw new Error(
            `Image upload failed (storage responded ${result.status}). Please retry.`,
          );
        setProgress("Checking your image…");
        await request(`/profile/images/${r.id}/complete`, {});
        URL.revokeObjectURL(item.preview);
        urls.current.delete(item.preview);
        setPending(null);
        setProgress("");
      } catch (error) {
        setProgress(
          "Your image was not saved. Retry the upload or choose another image. Your previous image is unchanged.",
        );
        throw error;
      }
    }, "Business image saved.");
  return (
    <Panel title="Business photos & branding">
      <p>
        A recognizable logo, a welcoming cover photo, and examples of your work
        help customers get to know your business.
      </p>
      {!profile && (
        <p className="business-tip">
          Save your business details below to unlock image uploads.
        </p>
      )}
      <p className="muted">
        JPG, PNG, or WebP · up to 10 MB each. Upload only images you have
        permission to publish. Do not include identity documents or customers’
        private information.
      </p>
      <div className="business-media-grid">
        {businessImageSlots.map((slot) => {
          const image = profile?.images?.find((i) => i.slot === slot),
            selected = pending?.slot === slot ? pending : null;
          const label =
            slot === "logo"
              ? "Business logo"
              : slot === "cover"
                ? "Cover photo"
                : "Work photo " + slot.slice(-1);
          return (
            <section key={slot} className={"business-media-slot " + slot}>
              <div className="business-image-frame">
                {selected || image ? (
                  <img src={selected?.preview || image?.url} alt={label} />
                ) : (
                  <div className="business-image-empty">
                    <ImagePlus size={30} />
                    <span>{label}</span>
                  </div>
                )}
              </div>
              <strong>{label}</strong>
              <small>
                {slot === "logo"
                  ? "Square image works best"
                  : slot === "cover"
                    ? "Wide landscape photo works best"
                    : "Show a real project or your team"}
              </small>
              <label className="business-image-picker">
                <Upload size={16} />
                {image ? "Replace image" : "Choose image"}
                <input
                  aria-label={"Upload " + label}
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  disabled={!profile || busy || !!pending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const error = imageError(file);
                    if (error) {
                      setProgress(error);
                      return;
                    }
                    const preview = URL.createObjectURL(file);
                    urls.current.add(preview);
                    const item = { slot, file, preview };
                    setPending(item);
                    upload(item);
                  }}
                />
              </label>
              {image && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy || !!pending}
                  onClick={() =>
                    void run(
                      () =>
                        request(`/profile/images/${slot}`, undefined, "DELETE"),
                      "Business image removed.",
                    )
                  }
                >
                  <X size={14} />
                  Remove
                </button>
              )}
            </section>
          );
        })}
      </div>
      {progress && <p role="status">{progress}</p>}
      {pending && !busy && (
        <div className="actions">
          <button type="button" onClick={() => upload(pending)}>
            Retry upload
          </button>
          <button type="button" className="secondary" onClick={clear}>
            Choose another image
          </button>
        </div>
      )}
    </Panel>
  );
}
