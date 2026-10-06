import { Router } from "express";
import type Stripe from "stripe";
import { pool, transaction } from "./db/index.js";
import { env } from "./config.js";
import { fail } from "./errors.js";
import { stripe } from "./integrations/stripe.js";

export const identityVerification = Router();
identityVerification.use((req, res, next) => {
  if (req.account.role !== "pro") fail(403, "Professional account required.");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Only a signed webhook grants verification. A completed browser flow is not proof.
function state(
  verified: boolean,
  session?: Stripe.Identity.VerificationSession,
) {
  const reasons: Record<string, string> = {
    document_expired: "Use a current, unexpired identity document.",
    document_unverified_other:
      "Try again with a clear photo of your identity document.",
    document_type_not_supported:
      "Use one of the document types accepted by Stripe.",
    selfie_face_mismatch:
      "Retake your selfie so it matches your identity document.",
    selfie_unverified_other:
      "Retake your selfie in good lighting with your face clearly visible.",
    consent_declined: "Your consent is required to continue verification.",
  };
  return {
    status: verified
      ? "verified"
      : session?.status === "verified"
        ? "processing"
        : session?.status || "not_started",
    awaitingConfirmation: !verified && session?.status === "verified",
    needsAttention:
      session?.status === "requires_input" && !!session.last_error,
    message: session?.last_error
      ? reasons[session.last_error.code || ""] ||
        "Stripe needs another attempt. Review the instructions in the secure verification window."
      : "",
  };
}
identityVerification.get("/", async (req, res) => {
  const p = (
    await pool.query(
      "SELECT verified,identity_session_id FROM profiles WHERE id=$1",
      [req.account.id],
    )
  ).rows[0];
  if (!p) fail(409, "Save your business profile first.");
  const session =
    !p.verified && p.identity_session_id
      ? await stripe().identity.verificationSessions.retrieve(
          p.identity_session_id,
        )
      : undefined;
  res.json(state(p.verified, session));
});
identityVerification.post("/", async (req, res) => {
  const result = await transaction(async (c) => {
    const p = (
      await c.query(
        "SELECT verified,identity_session_id FROM profiles WHERE id=$1 FOR UPDATE",
        [req.account.id],
      )
    ).rows[0];
    if (!p) fail(409, "Save your business profile first.");
    if (p.verified) return state(true);
    let session = p.identity_session_id
      ? await stripe().identity.verificationSessions.retrieve(
          p.identity_session_id,
        )
      : undefined;
    if (session?.status === "processing" || session?.status === "verified")
      return state(false, session);
    if (!session || session.status === "canceled") {
      session = await stripe().identity.verificationSessions.create(
        {
          type: "document",
          metadata: { userId: req.account.id },
          options: { document: { require_matching_selfie: true } },
          return_url:
            env.SITE_URL.replace(/\/$/, "") + "/app/verification/return",
        },
        {
          idempotencyKey:
            "identity:" +
            req.account.id +
            ":" +
            (p.identity_session_id || "initial"),
        },
      );
      await c.query("UPDATE profiles SET identity_session_id=$2 WHERE id=$1", [
        req.account.id,
        session.id,
      ]);
    }
    return {
      ...state(false, session),
      url: session.url,
      // This secret is returned only to its authenticated owner and never persisted client-side.
      ...(env.STRIPE_PUBLISHABLE_KEY && session.client_secret
        ? {
            clientSecret: session.client_secret,
            publishableKey: env.STRIPE_PUBLISHABLE_KEY,
          }
        : {}),
    };
  });
  res.json(result);
});
