export class StorageError extends Error {
  readonly status = 503;
  constructor(
    readonly code: "STORAGE_CONFIGURATION_ERROR" | "STORAGE_UNAVAILABLE",
    readonly diagnostic: { upstreamStatus?: number } = {},
  ) {
    super(
      code === "STORAGE_CONFIGURATION_ERROR"
        ? "Image storage is not configured correctly. Please contact support; your existing image is unchanged."
        : "Image storage is temporarily unavailable. Please retry; your existing image is unchanged.",
    );
    this.name = "StorageError";
  }
}
