import { CalendarDays } from "lucide-react";
import { weekdays } from "../shared/preferences.js";
import type { Profile } from "../shared/domain.js";
const dayNames = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
export function Availability({ profile }: { profile: Profile }) {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  };
  // Consecutive days with the same hours share one row.
  const rows: { from: string; to: string; hours: string }[] = [];
  for (const day of weekdays) {
    const slot = profile.weeklyHours?.[day];
    const hours = slot
      ? formatTime(slot.start) + " – " + formatTime(slot.end)
      : "Closed";
    const last = rows[rows.length - 1];
    if (last?.hours === hours) last.to = dayNames[day];
    else rows.push({ from: dayNames[day], to: dayNames[day], hours });
  }
  return (
    <div className="published-hours">
      <h3>
        <CalendarDays size={18} /> Available visit hours
      </h3>
      {Object.keys(profile.weeklyHours || {}).length ? (
        <>
          <dl className="availability-list">
            {rows.map((row) => (
              <div key={row.from}>
                <dt>
                  {row.from === row.to ? row.from : row.from + " – " + row.to}
                </dt>
                <dd>{row.hours}</dd>
              </div>
            ))}
          </dl>
          <p>Times in {profile.timeZone.replace(/_/g, " ")}.</p>
        </>
      ) : (
        <p>No visit hours published yet. Ask in chat.</p>
      )}
    </div>
  );
}
