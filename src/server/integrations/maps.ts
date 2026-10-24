import { env } from "../config.js";
import { requireValue, fail } from "../errors.js";
export async function locate(zip: string) {
  requireValue(
    env.GOOGLE_MAPS_SERVER_KEY,
    "Location lookup is not configured yet.",
  );
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.search = new URLSearchParams({
    components: "postal_code:" + zip + "|country:US",
    key: env.GOOGLE_MAPS_SERVER_KEY,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) fail(502, "Location lookup is unavailable.");
  const data = await response.json();
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") fail(502, "Location lookup is unavailable.");
  const result = data.results[0];
  return {
    label: result.formatted_address,
    zip:
      result.address_components?.find((c: any) =>
        c.types.includes("postal_code"),
      )?.long_name || "",
    region:
      result.address_components?.find((c: any) =>
        c.types.includes("administrative_area_level_1"),
      )?.short_name || "",
    country:
      result.address_components?.find((c: any) => c.types.includes("country"))
        ?.short_name || "",
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  };
}
