const stamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
// RFC 5545 content lines are folded at 75 octets.
const fold = (line: string) =>
  line.length <= 74 ? line : line.match(/.{1,74}/g)!.join("\r\n ");

export function appointmentIcs(input: {
  id: string;
  title: string;
  startsAt: string;
  location?: string;
  description?: string;
  minutes?: number;
}) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + (input.minutes || 60) * 60000);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aplime//Project appointment//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${input.id}@aplime.com`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(input.title)}`,
      input.location ? `LOCATION:${escape(input.location)}` : "",
      input.description ? `DESCRIPTION:${escape(input.description)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}

export const directionsUrl = (address: string) =>
  "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent(address);

export function downloadIcs(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
