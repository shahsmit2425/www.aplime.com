import { env } from "../config.js";
import { fail, requireValue } from "../errors.js";

async function places(path: string, fields: string, body?: unknown) {
  requireValue(
    env.GOOGLE_MAPS_SERVER_KEY,
    "Address suggestions are not configured yet.",
  );
  const response = await fetch("https://places.googleapis.com/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_MAPS_SERVER_KEY,
      "X-Goog-FieldMask": fields,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    fail(502, "Google address lookup is unavailable. Please retry shortly.");
  return response.json();
}
export async function autocompleteAddress(input: string, sessionToken: string) {
  const data = await places(
    "places:autocomplete",
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    {
      input,
      includedRegionCodes: ["us"],
      sessionToken,
      languageCode: "en",
    },
  );
  return (data.suggestions || [])
    .filter((item: any) => item.placePrediction?.placeId)
    .slice(0, 5)
    .map((item: any) => ({
      placeId: item.placePrediction.placeId,
      address: item.placePrediction.text.text,
    }));
}
export async function locateAddress(placeId: string, sessionToken?: string) {
  const data = await places(
    "places/" +
      encodeURIComponent(placeId) +
      (sessionToken ? "?sessionToken=" + encodeURIComponent(sessionToken) : ""),
    "id,formattedAddress,addressComponents,location",
  );
  const component = (type: string) =>
    data.addressComponents?.find((item: any) => item.types.includes(type));
  if (
    component("country")?.shortText !== "US" ||
    !component("street_number") ||
    !component("route") ||
    !/^\d{5}$/.test(component("postal_code")?.longText || "") ||
    !Number.isFinite(data.location?.latitude) ||
    !Number.isFinite(data.location?.longitude)
  )
    fail(
      400,
      "Select a complete US street address with a street number and ZIP code.",
    );
  return {
    placeId: data.id,
    label: data.formattedAddress,
    zip: component("postal_code").longText,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
