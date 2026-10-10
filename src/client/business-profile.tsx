import { AddressAutocomplete } from "./address-autocomplete.js";
import { useEffect, useState } from "react";
import { Building2, ImagePlus, Eye } from "lucide-react";
import { categories } from "../shared/domain.js";
import { hasBusinessBranding } from "../shared/business-images.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Empty, Head, Panel, Field, Form } from "./ui.js";
import { BusinessMedia } from "./business-media.js";
import { BusinessDisplay } from "./business-display.js";

export function BusinessProfile() {
  const { data, run, busy, go, id } = useWorkspace();
  const [tab, setTab] = useState(id === "setup" ? "setup" : "details");
  useEffect(() => {
    setTab(id === "setup" ? "setup" : "details");
  }, [id]);
  if (data.user.role !== "pro")
    return <Empty title="Professional account required" />;
  const p = data.profiles.find((p) => p.id === data.user.id);
  const steps = [
    { id: "details", label: "Business details", Icon: Building2 },
    { id: "photos", label: "Logo & advertising image", Icon: ImagePlus },
    { id: "preview", label: "View profile", Icon: Eye },
  ];
  return (
    <>
      <Head
        title={tab === "setup" ? "Marketplace review" : "Your business profile"}
      >
        A few details, two images, and your working hours. Keep it simple and
        let customers get to know your business.
      </Head>
      {p?.suspended && (
        <p className="business-tip">
          Your listing is suspended. Contact support before accepting new
          requests.
        </p>
      )}
      {p?.reviewNote && (
        <p className="business-tip">
          <strong>Profile review note:</strong> {p.reviewNote}
        </p>
      )}
      {!p && (
        <p className="business-tip">
          First save your basic details. Then add your logo, advertising image,
          and schedule.
        </p>
      )}
      {tab !== "setup" && (
        <nav
          className="business-section-nav"
          aria-label="Business profile sections"
        >
          {steps.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "business-step active" : "business-step"}
              aria-current={tab === id ? "page" : undefined}
              disabled={id !== "details" && !p}
              title={
                !p && id !== "details"
                  ? "Save your business details first"
                  : label
              }
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {tab === "preview" && p && <BusinessDisplay profile={p} preview />}
      <div hidden={tab !== "photos"}>
        <BusinessMedia profile={p} />
      </div>
      {tab === "setup" && (
        <>
          <Panel title="Marketplace review">
            {!hasBusinessBranding(
              p?.images?.map((image) => image.slot) || [],
            ) && (
              <p className="business-tip">
                Add your logo and advertising image in the images tab before
                submitting for review.
              </p>
            )}
            <p>
              Aplime reviews your saved business details after identity
              verification. Once you are approved, your listing stays live while
              later edits are re-checked. New or previously declined listings
              stay in draft until you resubmit them.
            </p>
            <button
              disabled={
                busy ||
                !p ||
                !p.verified ||
                !hasBusinessBranding(
                  p.images?.map((image) => image.slot) || [],
                ) ||
                p.reviewStatus === "pending" ||
                p.reviewStatus === "approved"
              }
              onClick={() =>
                void run(
                  () => request("/profile/submit-review", {}),
                  "Your business profile was submitted for review.",
                )
              }
            >
              {p?.reviewStatus === "pending"
                ? p?.listed
                  ? "Listed · changes under review"
                  : "Review in progress"
                : p?.reviewStatus === "approved"
                  ? "Marketplace approved"
                  : "Submit profile for review"}
            </button>
          </Panel>
        </>
      )}

      <div hidden={tab !== "details"}>
        <Panel title="Basic business details">
          <p>
            Your name, description, phone, and email appear on your profile.
            Your street address stays private.
          </p>
          <Form
            busy={busy}
            onSubmit={(f) =>
              run(
                () =>
                  request(
                    "/profile",
                    {
                      business: f.get("business"),
                      category: f.get("category"),
                      bio: f.get("bio"),
                      address: f.get("address"),
                      placeId: f.get("placeId"),
                      rate: Number(f.get("rate")),
                      serviceRadiusMiles: Number(f.get("serviceRadiusMiles")),
                      available: p?.available ?? true,
                      availability: p?.availability || [],
                      details: {
                        ...p?.details,
                        phone: String(f.get("phone") || ""),
                        email: String(f.get("email") || ""),
                        website: String(f.get("website") || ""),
                      },
                    },
                    "PUT",
                  ),
                "Business details saved.",
                () => {
                  if (!p) setTab("photos");
                },
              )
            }
          >
            <div className="form-grid">
              <Field label="Business name">
                <input
                  name="business"
                  defaultValue={p?.business}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="organization"
                />
              </Field>
              <Field label="Main service">
                <select name="category" defaultValue={p?.category}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Short business description">
              <textarea
                name="bio"
                defaultValue={p?.bio}
                required
                minLength={20}
                maxLength={2000}
                rows={3}
                placeholder="What do you do, and how can you help customers?"
              />
            </Field>
            <div className="form-grid">
              <Field label="Business phone">
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={30}
                  defaultValue={p?.details?.phone}
                />
              </Field>
              <Field label="Business email">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  defaultValue={p?.details?.email || data.user.email}
                />
              </Field>
              <Field label="Website (optional)">
                <input
                  name="website"
                  type="url"
                  placeholder="https://yourbusiness.com"
                  maxLength={2000}
                  defaultValue={p?.details?.website}
                />
              </Field>
              <Field label="Starting hourly rate (USD)">
                <input
                  name="rate"
                  type="number"
                  min={1}
                  max={10000}
                  step=".01"
                  required
                  defaultValue={p?.rate}
                />
              </Field>
            </div>
            <AddressAutocomplete
              label="Private business base address"
              defaultAddress={p?.address}
              defaultPlaceId={p?.placeId}
            />
            <Field label="How far do you travel? (miles)">
              <input
                name="serviceRadiusMiles"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={p?.serviceRadiusMiles ?? 25}
              />
            </Field>
            <div className="business-save">
              <p>You can update your images and schedule in the tabs above.</p>
              <button>{busy ? "Saving…" : "Save business details"}</button>
            </div>
          </Form>
        </Panel>
      </div>
    </>
  );
}
