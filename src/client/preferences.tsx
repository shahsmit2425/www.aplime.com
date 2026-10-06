import { useState } from "react";
import { CalendarDays, MapPin, Check } from "lucide-react";
import { weekdays, type WeeklyHours } from "../shared/preferences.js";
import { categories, type Profile } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
import { Empty, Head, Panel, Form, Field } from "./ui.js";

export function Preferences() {
  const { data, run, busy, go } = useWorkspace();
  const profile = data.profiles.find((p) => p.id === data.user.id);
  if (!profile)
    return (
      <Empty title="Save your business profile first.">
        <button onClick={() => go("profile")}>Business profile</button>
      </Empty>
    );
  return (
    <>
      <Head title="Your services, area and availability.">
        Choose the work you want and publish the hours customers can request.
      </Head>
      <PreferencesForm
        key={profile.id}
        profile={profile}
        run={run}
        busy={busy}
      />
    </>
  );
}
export function PreferencesForm({
  profile,
  run,
  busy,
  scheduleOnly = false,
}: {
  profile: Profile;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  busy: boolean;
  scheduleOnly?: boolean;
}) {
  const [hours, setHours] = useState<WeeklyHours>(profile.weeklyHours || {});
  return (
    <Panel title={scheduleOnly ? "Work schedule" : "Project preferences"}>
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
        {scheduleOnly ? (
          <>
            {(profile.serviceCategories?.length
              ? profile.serviceCategories
              : [profile.category]
            ).map((category) => (
              <input
                key={category}
                type="hidden"
                name="serviceCategories"
                value={category}
              />
            ))}
            <input
              type="hidden"
              name="serviceRadiusMiles"
              value={profile.serviceRadiusMiles}
            />
          </>
        ) : (
          <>
            <fieldset>
              <legend>Services you want to receive</legend>
              <div className="preference-grid">
                {categories.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      name="serviceCategories"
                      value={category}
                      defaultChecked={profile.serviceCategories?.includes(
                        category,
                      )}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
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
              <div className="preference-location">
                <MapPin size={19} />
                <span>
                  Measured from {profile.address || profile.zip}. Update your
                  base address in Business profile.
                </span>
              </div>
            </div>
          </>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            name="available"
            defaultChecked={profile.available}
          />
          Accepting new projects
        </label>
        <h3>Weekly calendar</h3>
        <p>
          Publish real working hours. Customers can request a one-hour visit
          inside these hours. Confirmed visits cannot overlap.
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
        <div className="weekly-hours">
          {weekdays.map((day) => (
            <div className="weekly-hours-row" key={day}>
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
                <strong>{day}</strong>
              </label>
              {hours[day] ? (
                <>
                  <label>
                    From
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
                  </label>
                  <label>
                    Until
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
                  </label>
                </>
              ) : (
                <span>Not available</span>
              )}
            </div>
          ))}
        </div>
        <button>
          <Check size={18} />
          {scheduleOnly ? "Save work schedule" : "Save preferences and hours"}
        </button>
      </Form>
    </Panel>
  );
}
