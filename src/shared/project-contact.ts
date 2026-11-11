import { z } from "zod";
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
  contactConsent: z.boolean({
    required_error:
      "Choose whether to share your phone number with professionals.",
  }),
});
