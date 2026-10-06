import { CalendarDays } from "lucide-react";
import { weekdays } from "../shared/preferences.js";
import type { Profile } from "../shared/domain.js";
export function Availability({ profile }: { profile: Profile }) {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  };
  return (
    <div className="published-hours">
      <h3>
        <CalendarDays size={18} /> Available visit hours
      </h3>
      <p>Times in {profile.timeZone}. Visits require confirmation.</p>
      {Object.keys(profile.weeklyHours || {}).length ? (
        <dl className="availability-list">
          {weekdays.map((day) => (
            <div key={day}>
              <dt>
                {
                  {
                    Mon: "Monday",
                    Tue: "Tuesday",
                    Wed: "Wednesday",
                    Thu: "Thursday",
                    Fri: "Friday",
                    Sat: "Saturday",
                    Sun: "Sunday",
                  }[day]
                }
              </dt>
              <dd>
                {profile.weeklyHours?.[day]
                  ? formatTime(profile.weeklyHours[day]!.start) +
                    " – " +
                    formatTime(profile.weeklyHours[day]!.end)
                  : "Closed"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>
          This professional has not published appointment hours yet. Ask in
          chat.
        </p>
      )}
    </div>
  );
}
