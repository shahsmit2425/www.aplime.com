import { AddressAutocomplete } from "./address-autocomplete.js";
import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  ImagePlus,
  Users,
  Eye,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { businessFields, businessFieldGroups } from "../shared/business.js";
import { categories } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { request, openExternal } from "./api.js";
import { Empty, Head, Panel, Field, Form } from "./ui.js";
import { BusinessMedia } from "./business-media.js";
import { BusinessDisplay } from "./business-display.js";
export function BusinessProfile() {
  const { data, run, busy, go } = useWorkspace();
  const [tab, setTab] = useState("details");
  if (data.user.role !== "pro")
    return <Empty title="Professional account required" />;
  const p = data.profiles.find((p) => p.id === data.user.id);
  const imageCount = p?.images?.length || 0;
  const steps = [
    {
      id: "details",
      label: "Business details",
      Icon: Building2,
      done: !!p,
      status: p ? "Details saved" : "Add your details",
    },
    {
      id: "photos",
      label: "Photos & logo",
      Icon: ImagePlus,
      done: imageCount > 0,
      status: imageCount + " / 7 images",
    },
    {
      id: "setup",
      label: "Verification & review",
      Icon: ShieldCheck,
      done: !!p?.verified && (p?.reviewStatus === "approved" || !!p?.listed),
      status: !p?.verified
        ? "Identity verification needed"
        : p.reviewStatus === "approved"
          ? "Marketplace approved"
          : p.listed
            ? "Listed · changes under review"
            : "Review " + p.reviewStatus.replace("_", " "),
    },
    {
      id: "preview",
      label: "Profile preview",
      Icon: Eye,
      done: !!p,
      status: "See what customers see",
    },
  ];
  return (
    <>
      <Head title="Make your business stand out">
        Show customers who you are, what you do, and why your business is right
        for their project. Work through each step below.
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
      <nav
        className="business-section-nav"
        aria-label="Business profile sections"
      >
        {steps.map(({ id, label, Icon, done, status }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "business-step active" : "business-step"}
            aria-current={tab === id}
            disabled={id !== "details" && !p}
            title={!p && id !== "details" ? "Save your details first" : status}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            <span>
              {label}
              <small>{status}</small>
            </span>
            {done ? (
              <CheckCircle2 size={16} aria-label="Complete" />
            ) : (
              <CircleDashed size={16} aria-label="Incomplete" />
            )}
          </button>
        ))}
      </nav>
      {tab === "preview" && p && (
        <>
          <p className="business-tip">
            Preview of your saved information. A public listing also requires
            verified identity, administrator approval, and an active
            subscription.
          </p>
          <BusinessDisplay profile={p} preview />
        </>
      )}
      {tab === "photos" && (
        <>
          <BusinessMedia profile={p} />
          <div className="business-save">
            <p>Done with photos? Check verification and submit for review.</p>
            <button type="button" onClick={() => setTab("setup")}>
              Continue to verification
            </button>
          </div>
        </>
      )}
      {tab === "setup" && (
        <>
          <div className="two-columns" id="business-setup">
            <Panel title="Identity verification">
              <ShieldCheck />
              <p>
                {p?.verified
                  ? "Your identity is verified. This does not verify business licensing or insurance."
                  : "Save your details, then complete identity verification securely through Stripe."}
              </p>
              <button
                disabled={busy || !p || p.verified}
                onClick={() =>
                  void run(async () => {
                    const r = await request("/profile/identity", {});
                    await openExternal(r.url);
                  }, "")
                }
              >
                {p?.verified ? "Identity verified" : "Verify identity"}
              </button>
            </Panel>
            <Panel title="Business membership">
              <p>
                Activate your Aplime subscription to appear in the marketplace
                and respond to new opportunities. Customer service payments are
                arranged directly.
              </p>
              <button onClick={() => go("subscription")}>
                Manage subscription
              </button>
            </Panel>
          </div>
          <Panel title="Marketplace review">
            <p>
              Aplime reviews your saved business details after identity
              verification. Once you are approved, your listing stays live
              while later edits are re-checked. New or previously declined
              listings stay in draft until you resubmit them.
            </p>
            <button
              disabled={
                busy ||
                !p ||
                !p.verified ||
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
        <Panel title="Tell customers about your business">
          <p>
            Fields are required unless marked optional. Information entered
            here appears on your business profile.
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
                      available: f.get("available") === "on",
                      availability: f.getAll("days"),
                      details: {
                        ...Object.fromEntries(
                          businessFields.map((field) => [
                            field.key,
                            String(f.get(field.key) || ""),
                          ]),
                        ),
                        yearsExperience: Number(f.get("yearsExperience")),
                        teamSize: Number(f.get("teamSize")),
                        businessType: f.get("businessType"),
                      },
                    },
                    "PUT",
                  ),
                "Your business details have been saved.",
                () => {
                  if (!p) setTab("photos");
                },
              )
            }
          >
            <section className="business-form-section">
              <h3>
                <Building2 size={20} />
                Business introduction
              </h3>
              <div className="form-grid">
                <Field label="Public business name">
                  <input
                    name="business"
                    defaultValue={p?.business}
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="The name customers recognize"
                  />
                </Field>
                <Field label="Primary service">
                  <select name="category" defaultValue={p?.category}>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="About your business">
                <textarea
                  name="bio"
                  defaultValue={p?.bio}
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={5}
                  placeholder="Introduce your business, describe your approach, and explain what customers can expect."
                />
              </Field>
            </section>
            <section className="business-form-section">
              <h3>
                <Users size={20} />
                Experience & team
              </h3>
              <div className="form-grid">
                <Field label="Business type">
                  <select
                    name="businessType"
                    defaultValue={p?.details?.businessType}
                  >
                    {[
                      "Sole proprietor",
                      "LLC",
                      "Corporation",
                      "Partnership",
                      "Other",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Years of experience">
                  <input
                    name="yearsExperience"
                    type="number"
                    min={0}
                    max={100}
                    required
                    defaultValue={p?.details?.yearsExperience ?? 0}
                  />
                </Field>
                <Field label="Team size">
                  <input
                    name="teamSize"
                    type="number"
                    min={1}
                    max={10000}
                    required
                    defaultValue={p?.details?.teamSize ?? 1}
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
            </section>
            {businessFieldGroups.map((group) => (
              <section className="business-form-section" key={group.title}>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
                <div className="form-grid">
                  {businessFields
                    .filter((field) =>
                      (group.keys as readonly string[]).includes(field.key),
                    )
                    .map((field) => (
                      <Field label={field.label} key={field.key}>
                        {[
                          "serviceAreas",
                          "specialties",
                          "hours",
                          "license",
                          "insurance",
                          "qualifications",
                          "warranty",
                          "cancellationPolicy",
                        ].includes(field.key) ? (
                          <textarea
                            name={field.key}
                            defaultValue={p?.details?.[field.key] || ""}
                            required={"required" in field && field.required}
                            maxLength={field.key === "hours" ? 500 : 1000}
                            rows={3}
                          />
                        ) : (
                          <input
                            name={field.key}
                            defaultValue={p?.details?.[field.key] || ""}
                            required={"required" in field && field.required}
                            type={
                              "type" in field
                                ? field.type
                                : field.key === "phone"
                                  ? "tel"
                                  : "text"
                            }
                            maxLength={
                              field.key === "phone"
                                ? 30
                                : field.key === "email"
                                  ? 254
                                  : field.key === "languages"
                                    ? 200
                                    : field.key === "legalName"
                                      ? 150
                                      : field.key === "city" ||
                                          field.key === "state"
                                        ? 100
                                        : 1000
                            }
                          />
                        )}
                      </Field>
                    ))}
                  {group.title === "Contact & location" && (
                    <>
                      <AddressAutocomplete
                        label="Private business base address"
                        defaultAddress={p?.address}
                        defaultPlaceId={p?.placeId}
                      />
                      <Field label="Service radius (miles)">
                        <input
                          name="serviceRadiusMiles"
                          type="number"
                          min={1}
                          max={100}
                          required
                          defaultValue={p?.serviceRadiusMiles ?? 25}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </section>
            ))}
            <input
              type="hidden"
              name="available"
              value={p?.available === false ? "" : "on"}
            />
            {(p?.availability || []).map((day) => (
              <input key={day} type="hidden" name="days" value={day} />
            ))}
            <p className="business-tip">
              Manage your project categories and customer-visible hours in{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => go("availability")}
              >
                Calendar & preferences
              </button>{" "}
              after saving your profile.
            </p>
            <div className="business-save">
              <p>
                Save your details, then continue to photos and verification.
              </p>
              <button>{busy ? "Saving…" : "Save business details"}</button>
            </div>
          </Form>
        </Panel>
      </div>
    </>
  );
}
