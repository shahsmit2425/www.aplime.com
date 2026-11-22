import { T } from "../shared/language.js";
import { useState } from "react";
import { MapPin, Check } from "lucide-react";
import { weekdays, type WeeklyHours } from "../shared/preferences.js";
import { categories, type Profile } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Empty, Head, Panel, Form, Field, ServiceIcon } from "./ui.js";

const dayNames = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export function Preferences() {
  const { data, run, busy, go } = useWorkspace();
  const profile = data.profiles.find((p) => p.id === data.user.id);
  if (!profile)
    return (
      <Empty title="Save your business profile first.">
        <button onClick={() => go("profile")}>
          <T>{"Business profile"}</T>
        </button>
      </Empty>
    );
  return (
    <>
      <Head title={<T>{"Your services, area and availability."}</T>} />
      <PreferencesForm
        key={profile.id}
        profile={profile}
        run={run}
        busy={busy}
      />
    </>
  );
}
function PreferencesForm({
  profile,
  run,
  busy,
}: {
  profile: Profile;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  busy: boolean;
}) {
  const [hours, setHours] = useState<WeeklyHours>(profile.weeklyHours || {});
  const open = weekdays.filter((day) => hours[day]).length;
  return (
    <Form
      busy={busy}
      onSubmit={(f) =>
        run(
          () =>
            request(
              "/profile/preferences",
              {
                serviceCategories: f.getAll("serviceCategories"),
                serviceRadiusMiles: Number(f.get("serviceRadiusMiles")),
                available: f.get("available") === "on",
                weeklyHours: hours,
                timeZone: f.get("timeZone"),
              },
              "PUT",
            ),
          "Preferences and calendar saved.",
        )
      }
    >
      <div className="preferences">
        <Panel title="Services you offer">
          <p>Choose every service you want to receive projects for.</p>
          <div className="preferences-services">
            {categories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  name="serviceCategories"
                  value={category}
                  defaultChecked={profile.serviceCategories?.includes(category)}
                />
                <ServiceIcon service={category} size={18} />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </Panel>
        <Panel title="Service area and availability">
          <div className="preferences-area">
            <Field label="Service radius (miles)">
              <input
                name="serviceRadiusMiles"
                type="number"
                min="1"
                max="100"
                required
                defaultValue={profile.serviceRadiusMiles}
              />
            </Field>
            <p>
              <MapPin size={18} aria-hidden="true" />
              <span>
                Measured from {profile.address || profile.zip}. Update your base
                address in Business profile.
              </span>
            </p>
          </div>
          <label className="preferences-switch">
            <input
              type="checkbox"
              name="available"
              defaultChecked={profile.available}
            />
            <span>
              <strong>Accepting new projects</strong>
              <small>Turn off to stop appearing in search and matches.</small>
            </span>
          </label>
        </Panel>
        <Panel title="Working hours">
          <p>
            Customers can request a one-hour visit inside these hours. Confirmed
            visits cannot overlap.
          </p>
          <Field label="Business time zone">
            <select
              name="timeZone"
              defaultValue={profile.timeZone || "America/New_York"}
            >
              {[
                ...new Set(
                  [
                    profile.timeZone,
                    "America/New_York",
                    "America/Chicago",
                    "America/Denver",
                    "America/Phoenix",
                    "America/Los_Angeles",
                    "America/Anchorage",
                    "Pacific/Honolulu",
                  ].filter(Boolean),
                ),
              ].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          <ul className="preferences-hours">
            {weekdays.map((day) => (
              <li key={day} data-open={!!hours[day] || undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!hours[day]}
                    onChange={(event) =>
                      setHours((previous) => {
                        const next = { ...previous };
                        if (event.target.checked)
                          next[day] = { start: "08:00", end: "17:00" };
                        else delete next[day];
                        return next;
                      })
                    }
                  />
                  <strong>{dayNames[day]}</strong>
                </label>
                {hours[day] ? (
                  <div>
                    <input
                      aria-label={day + " start"}
                      type="time"
                      required
                      value={hours[day]!.start}
                      onChange={(event) =>
                        setHours({
                          ...hours,
                          [day]: { ...hours[day]!, start: event.target.value },
                        })
                      }
                    />
                    <span>to</span>
                    <input
                      aria-label={day + " end"}
                      type="time"
                      required
                      value={hours[day]!.end}
                      onChange={(event) =>
                        setHours({
                          ...hours,
                          [day]: { ...hours[day]!, end: event.target.value },
                        })
                      }
                    />
                  </div>
                ) : (
                  <span>
                    <T>{"Closed"}</T>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        <div className="preferences-save">
          <p>
            {open
              ? `Open ${open} ${open === 1 ? "day" : "days"} a week.`
              : "No working hours selected."}{" "}
            Changes apply when you save.
          </p>
          <button>
            <Check size={18} />
            Save services and hours
          </button>
        </div>
      </div>
    </Form>
  );
}
