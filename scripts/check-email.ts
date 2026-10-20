import { z } from "zod";
import { env, validateEmailDelivery } from "../src/server/config.js";
import {
  EmailDeliveryError,
  sendEmail,
} from "../src/server/integrations/email.js";
try {
  validateEmailDelivery();
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--to"))
    throw new Error("Usage: npm run email:check [-- --to YOUR_EMAIL]");
  if (!args.length) {
    console.log(
      "Resend configuration is valid. No email sent or provider request made.",
    );
    console.log(
      "To send one test email to an inbox you control: npm run email:check -- --to YOUR_EMAIL",
    );
  } else {
    const to = z.string().trim().email().max(254).safeParse(args[1]);
    if (!to.success)
      throw new Error("--to must be a single valid email address.");
    const result = await sendEmail(
      to.data,
      `Aplime ${env.APP_ENV} email delivery test`,
      "Your Aplime Resend delivery test was accepted. Check the actual inbox and spam folder to confirm receipt.",
    );
    console.log("Resend accepted the test email. Provider ID: " + result.id);
    console.log(
      "Check your inbox/spam folder; acceptance alone does not prove inbox delivery.",
    );
  }
} catch (error) {
  if (error instanceof EmailDeliveryError)
    console.error("Resend diagnostic failed", {
      code: error.code,
      status: error.status,
    });
  else
    console.error(
      error instanceof Error
        ? error.message
        : "Email configuration check failed.",
    );
  process.exitCode = 1;
}
