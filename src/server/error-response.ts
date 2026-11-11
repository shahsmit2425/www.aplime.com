import { ZodError } from "zod";
import { AddressError } from "./integrations/address-error.js";
import { StorageError } from "./integrations/storage-error.js";
import { IdentityError } from "./integrations/identity-error.js";

export function errorResponse(error: unknown) {
  if (error instanceof IdentityError)
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.diagnostic.requestId
          ? { requestId: error.diagnostic.requestId }
          : {}),
      },
    };
  if (error instanceof AddressError || error instanceof StorageError)
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  const e = (error || {}) as {
    status?: number;
    message?: string;
    code?: string;
  };
  const status =
    error instanceof ZodError
      ? 400
      : e.code === "23505"
        ? 409
        : e.code === "22P02"
          ? 400
          : e.status || 500;
  const message =
    error instanceof ZodError
      ? error.issues[0]?.message
      : e.code === "23505"
        ? "This action has already been completed."
        : status < 500
          ? e.message
          : "The service is temporarily unavailable. Please try again.";
  return { status, body: { error: message } };
}
