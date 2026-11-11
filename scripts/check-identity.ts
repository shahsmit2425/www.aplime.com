import { env } from "../src/server/config.js";
import { stripe } from "../src/server/integrations/stripe.js";
import {
  IdentityError,
  identityFailure,
} from "../src/server/integrations/identity-error.js";

// Run in the Render API Shell. Read-only: never creates a verification session,
// uploads identity documents, or prints keys/session objects/customer details.
try {
  if (!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY))
    throw new IdentityError("IDENTITY_CONFIGURATION_ERROR", {
      operation: "check",
      reason: "SECRET_KEY_MISSING_OR_INVALID",
    });
  const mode = env.STRIPE_SECRET_KEY.startsWith("sk_test_") ? "test" : "live";
  if ((env.APP_ENV === "production") !== (mode === "live"))
    throw new IdentityError("IDENTITY_CONFIGURATION_ERROR", {
      operation: "check",
      reason: "SECRET_KEY_ENVIRONMENT_MISMATCH",
    });
  if (
    env.STRIPE_PUBLISHABLE_KEY &&
    !env.STRIPE_PUBLISHABLE_KEY.startsWith("pk_" + mode + "_")
  )
    throw new IdentityError("IDENTITY_CONFIGURATION_ERROR", {
      operation: "check",
      reason: "PUBLISHABLE_KEY_MODE_MISMATCH",
    });
  if (
    env.NODE_ENV === "production" &&
    new URL(env.SITE_URL).protocol !== "https:"
  )
    throw new IdentityError("IDENTITY_CONFIGURATION_ERROR", {
      operation: "check",
      reason: "SITE_URL_MUST_BE_HTTPS",
    });
  try {
    await stripe().identity.verificationSessions.list({ limit: 1 });
  } catch (error) {
    throw identityFailure(error, "check");
  }
  console.log(
    "Stripe Identity read access succeeded in " +
      mode +
      " mode. No verification session was created. This does not confirm permission to create sessions or webhook delivery.",
  );
  console.log(
    env.STRIPE_PUBLISHABLE_KEY
      ? "Publishable key mode matches; confirm both keys belong to the same Stripe account."
      : "No publishable key: the hosted verification fallback will be used.",
  );
} catch (error) {
  if (error instanceof IdentityError)
    console.error(error.code, error.diagnostic);
  else
    console.error(
      "Identity diagnostic failed before the Stripe request. Check deployment configuration.",
    );
  console.error(
    "Check the API's STRIPE_SECRET_KEY, matching Stripe account/test mode, Identity activation, API permissions and SITE_URL. Find any req_ reference in Stripe Workbench Logs. Do not paste keys or document data.",
  );
  process.exitCode = 1;
}
