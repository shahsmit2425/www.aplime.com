import { env } from "../config.js";
import { fail } from "../errors.js";
import { AddressError } from "./address-error.js";

async function places(path: string, fields: string, body?: unknown) {
  const key = env.GOOGLE_MAPS_SERVER_KEY.trim();
  if (!key) throw new AddressError("ADDRESS_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch("https://places.googleapis.com/v1/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fields,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new AddressError(
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "ADDRESS_TIMEOUT"
        : "ADDRESS_UNAVAILABLE",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    // Log only known provider reason codes; never raw provider messages.
    const reasons = new Set([
      "API_KEY_INVALID",
      "API_KEY_SERVICE_BLOCKED",
      "API_KEY_IP_ADDRESS_BLOCKED",
      "API_KEY_HTTP_REFERRER_BLOCKED",
      "SERVICE_DISABLED",
      "BILLING_DISABLED",
      "CONSUMER_INVALID",
      "RATE_LIMIT_EXCEEDED",
      "QUOTA_EXCEEDED",
    ]);
    const details = data?.error?.details;
    const reason = Array.isArray(details)
      ? details.find((d: any) => reasons.has(d?.reason))?.reason
      : undefined;
    throw new AddressError(
      [400, 401, 403].includes(response.status)
        ? "ADDRESS_CONFIGURATION_ERROR"
        : response.status === 429
          ? "ADDRESS_RATE_LIMITED"
          : "ADDRESS_UNAVAILABLE",
      { upstreamStatus: response.status, ...(reason ? { reason } : {}) },
    );
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AddressError("ADDRESS_UNAVAILABLE");
  return data;
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
  if (data.suggestions !== undefined && !Array.isArray(data.suggestions))
    throw new AddressError("ADDRESS_UNAVAILABLE");
  return (data.suggestions || [])
    .filter(
      (item: any) =>
        typeof item?.placePrediction?.placeId === "string" &&
        typeof item?.placePrediction?.text?.text === "string",
    )
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
