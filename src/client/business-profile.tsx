import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  ImagePlus,
  Users,
  CalendarDays,
  Eye,
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
  const [tab, setTab] = useState("edit");
  if (data.user.role !== "pro")
    return <Empty title="Professional account required" />;
  const p = data.profiles.find((p) => p.id === data.user.id);
  const sections = [
    { id: "business-details", label: "Business details", Icon: Building2 },
    { id: "business-photos", label: "Photos & logo", Icon: ImagePlus },
    {
      id: "business-setup",
      label: "Verification & membership",
      Icon: ShieldCheck,
    },
  ];
  return (
    <>
      <Head
        title="Make your business stand out"
        action={
          p ? (
            <button
              className="secondary"
              onClick={() => setTab(tab === "edit" ? "preview" : "edit")}
            >
              <Eye size={17} />
              {tab === "edit" ? "Preview saved profile" : "Back to editing"}
            </button>
          ) : undefined
        }
      >
        Show customers who you are, what you do, and why your business is right
        for their project.
      </Head>
      {p?.suspended && (
        <p className="business-tip">
          Your listing is suspended. Contact support before accepting new
          requests.
        </p>
      )}
      <div className="business-status">
        <span>
          <Building2 size={18} />
          {p ? "Details saved" : "Add business details"}
        </span>
        <span>
          <ImagePlus size={18} />
          {p?.images?.length || 0} / 7 images
        </span>
        <span>
          <ShieldCheck size={18} />
          {p?.verified ? "Identity verified" : "Identity verification needed"}
        </span>
      </div>
      {tab === "preview" && p && (
        <>
          <p className="business-tip">
            Preview of your saved information. A public listing also requires
            verified identity and an active subscription.
          </p>
          <BusinessDisplay profile={p} preview />
        </>
      )}
      <div hidden={tab !== "edit"}>
        <nav
          className="business-section-nav"
          aria-label="Business profile sections"
        >
          {sections.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={"#" + id}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Icon size={17} />
              {label}
            </a>
          ))}
        </nav>
        <div id="business-photos">
          <BusinessMedia profile={p} />
        </div>
        <div id="business-details">
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
                        zip: f.get("zip"),
                        rate: Number(f.get("rate")),
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
                      <Field label="Business ZIP code">
                        <input
                          name="zip"
                          defaultValue={p?.zip}
                          pattern="[0-9]{5}"
                          inputMode="numeric"
                          maxLength={5}
                          required
                          placeholder="Five-digit ZIP code"
                        />
                      </Field>
                    )}
                  </div>
                </section>
              ))}
              <section className="business-form-section">
                <h3>
                  <CalendarDays size={20} />
                  Availability
                </h3>
                <label className="checkbox">
                  <input
                    name="available"
                    type="checkbox"
                    defaultChecked={p?.available ?? true}
                  />
                  Accepting new project requests
                </label>
                <fieldset className="days">
                  <legend>Working days</legend>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          name="days"
                          value={day}
                          defaultChecked={p?.availability.includes(day)}
                        />
                        {day}
                      </label>
                    ),
                  )}
                </fieldset>
                <p>
                  These are your normal working days. Confirm each appointment
                  with the customer.
                </p>
              </section>
              <div className="business-save">
                <p>
                  Save your details, then add photos or preview your profile.
                </p>
                <button>{busy ? "Saving…" : "Save business details"}</button>
              </div>
            </Form>
          </Panel>
        </div>
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
              Activate your Aplime subscription to appear in the marketplace and
              respond to new opportunities. Customer service payments are
              arranged directly.
            </p>
            <button onClick={() => go("subscription")}>
              Manage subscription
            </button>
          </Panel>
        </div>
      </div>
    </>
  );
}
