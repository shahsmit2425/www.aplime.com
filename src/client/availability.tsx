import { CalendarDays } from "lucide-react";
import { weekdays } from "../shared/preferences.js";
import type { Profile } from "../shared/domain.js";
export function Availability({ profile }: { profile: Profile }) {
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
              <dt>{day}</dt>
              <dd>
                {profile.weeklyHours?.[day]
                  ? profile.weeklyHours[day]!.start +
                    " – " +
                    profile.weeklyHours[day]!.end
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
