import { autocompleteAddress } from "../src/server/integrations/address.js";
import { AddressError } from "../src/server/integrations/address-error.js";
import { randomUUID } from "node:crypto";

// Run in the API service's Render Shell. Does not print keys, addresses, or raw errors.
try {
  const suggestions = await autocompleteAddress(
    "1600 Amphitheatre Parkway Mountain View",
    randomUUID(),
  );
  if (!suggestions.length) {
    console.error(
      "Google Places responded successfully but returned no suggestions for the diagnostic query.",
    );
    process.exitCode = 1;
  } else
    console.log(
      "Google Places autocomplete is working. Suggestions received:",
      suggestions.length,
    );
} catch (error) {
  if (error instanceof AddressError) {
    console.error(error.code, error.diagnostic);
    console.error(
      "Check the API service's GOOGLE_MAPS_SERVER_KEY, enabled Places API (New), billing, API restrictions, and allowed Render outbound IPs. Browser-referrer restrictions cannot authorize this server request.",
    );
  } else
    console.error(
      "Map diagnostic failed before the Google request. Check server configuration.",
    );
  process.exitCode = 1;
}
