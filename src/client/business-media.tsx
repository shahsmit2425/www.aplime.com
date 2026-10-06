import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X, Eye, Trash2, RefreshCw } from "lucide-react";
import type { Profile } from "../shared/domain.js";
import { businessImageSlots } from "../shared/business-images.js";
import { imageError, IMAGE_TYPES } from "../shared/uploads.js";
import { useWorkspace } from "./workspace.js";
import { request, uploadImageContent } from "./api.js";
import { Panel } from "./ui.js";

type Selection = {
  slot: string;
  file: File;
  preview: string;
  reservation?: string;
  uploaded?: boolean;
};
export function BusinessMedia({ profile }: { profile?: Profile }) {
  const { run, busy } = useWorkspace();
  const [showOlderPhotos, setShowOlderPhotos] = useState(false);
  const [pending, setPending] = useState<Selection | null>(null);
  const [progress, setProgress] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    slot: string;
    id: string;
  } | null>(null);
  const [view, setView] = useState<{ url: string; label: string } | null>(null);
  const uploading = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (view) dialog.current?.showModal();
  }, [view]);
  const olderPhotos =
    profile?.images?.filter((image) => image.slot.startsWith("work-")) || [];
  const clear = () => {
    if (pending) {
      URL.revokeObjectURL(pending.preview);
      urls.current.delete(pending.preview);
    }
    setPending(null);
    setProgress("");
    setFailed(false);
    setView(null);
  };
  const upload = (item: Selection) => {
    if (uploading.current || busy) return;
    uploading.current = true;
    void run(async () => {
      setFailed(false);
      controller.current = new AbortController();
      try {
        if (!item.uploaded) {
          setProgress("Preparing a secure upload…");
          const reservation = await request<{ id: string; uploadPath: string }>(
            "/profile/images",
            {
              slot: item.slot,
              name: item.file.name,
              contentType: item.file.type,
              size: item.file.size,
              transport: "api",
            },
          );
          item.reservation = reservation.id;
          setProgress("Uploading image… Keep this page open.");
          await uploadImageContent(
            reservation.uploadPath,
            item.file,
            AbortSignal.any([
              controller.current.signal,
              AbortSignal.timeout(120000),
            ]),
          );
          item.uploaded = true;
        }
        setProgress("Checking and saving your image…");
        await request("/profile/images/" + item.reservation + "/complete", {});
        clear();
      } catch (error) {
        setFailed(true);
        setProgress(
          item.uploaded
            ? "The file uploaded, but saving could not be confirmed. Retry to check and finish saving."
            : (error as Error).message +
                " Your saved image has not been replaced.",
        );
        throw error;
      } finally {
        uploading.current = false;
        controller.current = null;
      }
    }, "Business image saved.");
  };
  return (
    <Panel title="Logo & advertising image">
      <p>
        Choose an image, check the preview, then save it. Replacing an image
        keeps the current one until the new image is saved successfully.
      </p>
      {!profile && (
        <p className="business-tip">
          Save your business details first to enable uploads.
        </p>
      )}
      <p className="muted">
        JPG, PNG or WebP · maximum 10 MB per image. Use images you have
        permission to publish.
      </p>
      <div className="business-media-grid">
        {businessImageSlots
          .filter(
            (slot) =>
              slot === "logo" ||
              slot === "cover" ||
              (showOlderPhotos &&
                olderPhotos.some((image) => image.slot === slot)),
          )
          .map((slot) => {
            const image = profile?.images?.find((i) => i.slot === slot);
            const selected = pending?.slot === slot ? pending : null;
            const label =
              slot === "logo"
                ? "Business logo"
                : slot === "cover"
                  ? "Advertising image"
                  : "Work photo " + slot.slice(-1);
            const source = selected?.preview || image?.url;
            return (
              <section
                key={slot}
                className={"business-media-slot " + slot}
                aria-label={label}
              >
                <div className="business-image-frame">
                  {source ? (
                    <img
                      src={source}
                      alt={selected ? label + " — unsaved preview" : label}
                    />
                  ) : (
                    <div className="business-image-empty">
                      <ImagePlus size={32} />
                      <span>No image yet</span>
                    </div>
                  )}
                </div>
                <div className="business-image-heading">
                  <strong>{label}</strong>
                  <span className="business-image-status">
                    {selected
                      ? failed
                        ? "Needs retry"
                        : "Not saved yet"
                      : image
                        ? "Saved"
                        : "Not uploaded"}
                  </span>
                </div>
                <small>
                  {slot === "logo"
                    ? "Use a square logo. The full image is kept."
                    : "Use a wide image to promote your business."}
                </small>
                {selected && (
                  <small className="business-file-name">
                    {selected.file.name} ·{" "}
                    {(selected.file.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                )}
                <div className="actions">
                  {source && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setView({ url: source, label })}
                    >
                      <Eye size={16} />
                      View image
                    </button>
                  )}
                  <label className="business-image-picker">
                    <Upload size={16} />
                    {selected
                      ? "Choose another"
                      : image
                        ? "Replace image"
                        : "Choose image"}
                    <input
                      aria-label={"Choose " + label}
                      type="file"
                      accept={IMAGE_TYPES.join(",")}
                      disabled={!profile || busy || (!!pending && !selected)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const problem = imageError(file);
                        if (problem) {
                          setProgress(problem);
                          setFailed(true);
                          return;
                        }
                        if (pending) {
                          URL.revokeObjectURL(pending.preview);
                          urls.current.delete(pending.preview);
                        }
                        const preview = URL.createObjectURL(file);
                        urls.current.add(preview);
                        setPending({ slot, file, preview });
                        setProgress("");
                        setFailed(false);
                        setConfirmDelete(null);
                        setView(null);
                      }}
                    />
                  </label>
                  {image && !selected && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !!pending}
                      onClick={() => setConfirmDelete({ slot, id: image.id })}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                </div>
                {selected && (
                  <div className="business-image-save">
                    <p>
                      {image
                        ? "This preview will replace the saved image only after you save."
                        : "This image is only a preview until you save."}
                    </p>
                    <div className="actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => upload(selected)}
                      >
                        {failed ? (
                          <RefreshCw size={16} />
                        ) : (
                          <Upload size={16} />
                        )}
                        {busy
                          ? "Saving…"
                          : failed
                            ? "Retry save"
                            : "Save image"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={clear}
                      >
                        Discard selection
                      </button>
                    </div>
                  </div>
                )}
                {confirmDelete?.slot === slot && (
                  <div
                    className="business-image-save"
                    role="group"
                    aria-label={"Confirm deletion of " + label}
                  >
                    <p>
                      Delete this {label.toLowerCase()} from your profile? You
                      can upload a new one later.
                    </p>
                    <div className="actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await request(
                              "/profile/images/" + slot,
                              { imageId: confirmDelete.id },
                              "DELETE",
                            );
                            setConfirmDelete(null);
                            setView(null);
                          }, "Business image deleted.")
                        }
                      >
                        Delete image
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setConfirmDelete(null)}
                      >
                        Keep image
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
      </div>
      {progress && (
        <p
          className={failed ? "business-upload-error" : "business-tip"}
          role={failed ? "alert" : "status"}
        >
          {progress}
        </p>
      )}
      {olderPhotos.length > 0 && (
        <button
          type="button"
          className="text-button"
          disabled={busy || !!pending}
          onClick={() => setShowOlderPhotos(!showOlderPhotos)}
        >
          {showOlderPhotos ? "Hide" : "Manage"} previous work photos (
          {olderPhotos.length})
        </button>
      )}
      {view && (
        <dialog
          ref={dialog}
          className="business-image-dialog"
          onCancel={() => setView(null)}
          onClose={() => setView(null)}
        >
          <div className="business-image-heading">
            <h2>{view.label}</h2>
            <button
              type="button"
              className="secondary"
              aria-label="Close image preview"
              onClick={() => setView(null)}
              autoFocus
            >
              <X size={20} />
              Close
            </button>
          </div>
          <img src={view.url} alt={view.label} />
        </dialog>
      )}
    </Panel>
  );
}
