/** Public locality only. Never derives a town from a ZIP, which can cover multiple places. */
export function addressLocality(address = "") {
  const match = address.match(
    /,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?(?:,\s*(?:USA|United States))?$/,
  );
  return { town: match?.[1]?.trim() || "", region: match?.[2] || "" };
}
export function locationLabel(location: {
  zip?: string;
  town?: string;
  region?: string;
  address?: string;
}) {
  const legacy = addressLocality(location.address);
  const place = [location.town || legacy.town, location.region || legacy.region]
    .filter(Boolean)
    .join(", ");
  return (
    [place, location.zip].filter(Boolean).join(" · ") || "Location in project"
  );
}
export function customerPreviewName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0]} ${Array.from(parts.at(-1)!)[0]}.`
    : parts[0] || "Customer";
}
