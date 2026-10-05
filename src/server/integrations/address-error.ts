// Only these fixed messages may cross the API boundary. Never expose Google's
// raw response, which can contain project identifiers or the submitted address.
const messages = {
  ADDRESS_NOT_CONFIGURED:
    "Address search is not configured. Please contact support.",
  ADDRESS_CONFIGURATION_ERROR:
    "Address search is unavailable because of a provider configuration issue. Please contact support.",
  ADDRESS_RATE_LIMITED:
    "Address search is busy. Please wait a moment and retry.",
  ADDRESS_TIMEOUT: "Address search took too long. Please retry.",
  ADDRESS_UNAVAILABLE:
    "Address search is temporarily unavailable. Please retry.",
} as const;
export class AddressError extends Error {
  readonly status = 503;
  constructor(
    readonly code: keyof typeof messages,
    readonly diagnostic: { upstreamStatus?: number; reason?: string } = {},
  ) {
    super(messages[code]);
    this.name = "AddressError";
  }
}
