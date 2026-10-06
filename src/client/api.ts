import { auth } from "./auth.js";
import { fallbackConfig } from "../shared/config.js";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T = any>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const token = await auth().currentUser?.getIdToken();
  const base = (window.__CONFIG__ || fallbackConfig).apiUrl;
  const response = await fetch(base + "/api" + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "Something went wrong. Please try again.",
      response.status,
    );
  return data;
}
export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:")
    throw new Error("A secure link is required.");
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else window.location.assign(url);
}

export async function uploadImageContent(
  path: string,
  file: File,
  signal: AbortSignal,
) {
  const token = await auth().currentUser?.getIdToken();
  const base = (window.__CONFIG__ || fallbackConfig).apiUrl;
  let response: Response;
  try {
    response = await fetch(base + "/api" + path, {
      method: "PUT",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        "Content-Type": file.type,
      },
      body: file,
      signal,
    });
  } catch (error) {
    if (signal.aborted)
      throw new Error("Upload stopped. You can retry or choose another image.");
    throw new Error(
      "Could not reach image storage. Check your connection and retry.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.error || "Image upload failed. Please retry.",
      response.status,
    );
}
