import { T } from "../shared/language.js";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X, Eye, Trash2, RefreshCw } from "lucide-react";
import type { Profile } from "../shared/domain.js";
import {
  businessImageSlots,
  MAX_BUSINESS_PORTFOLIO_IMAGES,
} from "../shared/business-images.js";
import { imageError, IMAGE_TYPES } from "../shared/uploads.js";
import { useWorkspace } from "./workspace.js";
import { request, uploadImageContent } from "./api.js";
import { Panel } from "./ui.js";
import { PortfolioPublication } from "./portfolio-publication.js";

type Selection = {
  slot: string;
  file: File;
  preview: string;
  reservation?: string;
  uploaded?: boolean;
};
export function BusinessMedia({
  profile,
  portfolio = false,
}: {
  profile?: Profile;
  portfolio?: boolean;
}) {
  const { run, busy, go } = useWorkspace();
  const [pending, setPending] = useState<Record<string, Selection>>({});
  const [statuses, setStatuses] = useState<
    Record<string, { progress: string; failed: boolean }>
  >({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const status = (slot: string, progress: string, failed = false) =>
    setStatuses((current) => ({ ...current, [slot]: { progress, failed } }));
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
  const savedCount =
    profile?.images?.filter((image) => image.slot.startsWith("work-")).length ||
    0;
  const workSlots = businessImageSlots.filter((slot) =>
    slot.startsWith("work-"),
  );
  const nextSlot = workSlots.find(
    (slot) =>
      !pending[slot] && !profile?.images?.some((image) => image.slot === slot),
  );
  const visibleSlots = portfolio
    ? workSlots.filter(
        (slot) =>
          pending[slot] ||
          profile?.images?.some((image) => image.slot === slot),
      )
    : businessImageSlots.filter((slot) => slot === "logo" || slot === "cover");
  const clear = (slot: string) => {
    const selected = pending[slot];
    if (selected) {
      URL.revokeObjectURL(selected.preview);
      urls.current.delete(selected.preview);
    }
    setPending((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    status(slot, "");
    setView(null);
  };
  const upload = (item: Selection) => {
    if (uploading.current || busy) return;
    uploading.current = true;
    setActiveSlot(item.slot);
    void run(async () => {
      status(item.slot, "");
      controller.current = new AbortController();
      try {
        if (!item.uploaded) {
          status(item.slot, "Preparing a secure upload…");
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
          status(item.slot, "Uploading image… Keep this page open.");
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
        status(item.slot, "Checking and saving your image…");
        await request("/profile/images/" + item.reservation + "/complete", {});
        clear(item.slot);
      } catch (error) {
        status(
          item.slot,
          item.uploaded
            ? "The file uploaded, but saving could not be confirmed. Retry to check and finish saving."
            : (error as Error).message +
                " Your saved image has not been replaced.",
          true,
        );
        throw error;
      } finally {
        uploading.current = false;
        setActiveSlot(null);
        controller.current = null;
      }
    }, "Business image saved.");
  };
  return (
    <Panel
      title={
        portfolio
          ? `Past work portfolio · ${savedCount} / ${MAX_BUSINESS_PORTFOLIO_IMAGES} photos`
          : "Logo & advertising image"
      }
    >
      <p>
        {portfolio
          ? `Show customers your past work. Add up to ${MAX_BUSINESS_PORTFOLIO_IMAGES} photos; customers see them after your profile updates are approved.`
          : "Choose an image, check the preview, then save it."}{" "}
        Your current image stays in place until its replacement is saved.
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
      {portfolio && profile && (
        <PortfolioPublication
          profile={profile}
          onReview={() => go("profile", "setup")}
        />
      )}
      <div
        className={
          "business-media-grid" + (portfolio ? " portfolio-media-grid" : "")
        }
      >
        {visibleSlots.map((slot) => {
          const image = profile?.images?.find((i) => i.slot === slot);
          const selected = pending[slot];
          const { progress, failed } = statuses[slot] || {
            progress: "",
            failed: false,
          };
          const label =
            slot === "logo"
              ? "Business logo"
              : slot === "cover"
                ? "Advertising image"
                : "Past work photo " + slot.slice("work-".length);
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
                      ? portfolio && profile?.portfolioPublication
                        ? profile.portfolioPublication.approvedImageIds.includes(
                            image.id,
                          )
                          ? "Approved"
                          : "Saved · awaiting review"
                        : "Saved"
                      : "Not uploaded"}
                </span>
              </div>
              <small>
                {slot === "logo"
                  ? "Use a square logo. The full image is kept."
                  : slot === "cover"
                    ? "Use a wide image to promote your business."
                    : "Show a completed job or a detail of your work."}
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
                    disabled={!profile || busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const problem = imageError(file);
                      if (problem) {
                        status(slot, problem, true);
                        return;
                      }
                      if (selected) {
                        URL.revokeObjectURL(selected.preview);
                        urls.current.delete(selected.preview);
                      }
                      const preview = URL.createObjectURL(file);
                      urls.current.add(preview);
                      setPending((current) => ({
                        ...current,
                        [slot]: { slot, file, preview },
                      }));
                      status(slot, "");
                      setConfirmDelete(null);
                      setView(null);
                    }}
                  />
                </label>
                {image && !selected && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirmDelete({ slot, id: image.id })}
                  >
                    <Trash2 size={16} />
                    <T>{"Delete"}</T>{" "}
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
                      {failed ? <RefreshCw size={16} /> : <Upload size={16} />}
                      {activeSlot === slot
                        ? "Saving…"
                        : failed
                          ? "Retry save"
                          : "Save image"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => clear(slot)}
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
                    Delete this {label.toLowerCase()} from your profile? You can
                    upload a new one later.
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
              {progress && (
                <p
                  className={failed ? "business-upload-error" : "business-tip"}
                  role={failed ? "alert" : "status"}
                >
                  {progress}
                </p>
              )}
            </section>
          );
        })}
        {portfolio && nextSlot && (
          <label className="portfolio-add-tile">
            <ImagePlus size={34} aria-hidden="true" />
            <strong>Add a past-work photo</strong>
            <span>
              {MAX_BUSINESS_PORTFOLIO_IMAGES - visibleSlots.length} spaces left
              · Preview before saving
            </span>
            <input
              type="file"
              aria-label="Add a past-work photo"
              accept={IMAGE_TYPES.join(",")}
              disabled={!profile || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const problem = imageError(file);
                if (problem) {
                  status("add", problem, true);
                  return;
                }
                const preview = URL.createObjectURL(file);
                urls.current.add(preview);
                setPending((current) => ({
                  ...current,
                  [nextSlot]: { slot: nextSlot, file, preview },
                }));
                status("add", "");
                status(nextSlot, "");
              }}
            />
          </label>
        )}
      </div>
      {portfolio && statuses.add?.progress && (
        <p role="alert" className="business-upload-error">
          {statuses.add.progress}
        </p>
      )}
      {portfolio && !nextSlot && (
        <p className="business-tip">
          All 20 spaces are in use. Replace or delete an existing photo to add
          another.
        </p>
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
              <T>{"Close"}</T>{" "}
            </button>
          </div>
          <img src={view.url} alt={view.label} />
        </dialog>
      )}
    </Panel>
  );
}
