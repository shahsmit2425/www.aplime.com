import { z } from "zod";
export const CONTACT_CONSENT =
  "I agree that professionals matched to this project may call or text me about this project after I submit it. This permission is not for unrelated marketing.";
export const contactInput = z.object({
  contactPhone: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.replace(/[\s().-]/g, ""))
    .transform((v) =>
      /^\d{10}$/.test(v) ? "+1" + v : /^1\d{10}$/.test(v) ? "+" + v : v,
    )
    .pipe(
      z
        .string()
        .regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/, "Enter a valid US phone number."),
    ),
  contactConsent: z.literal(true, {
    errorMap: () => ({
      message: "Please agree to project-related contact before publishing.",
    }),
  }),
});
