// Aplime's shared mailboxes. These are the same in every environment, so they
// are not environment variables. The support address stays in SUPPORT_EMAIL and
// automated mail is sent from EMAIL_FROM (notification@aplime.com).
export const contactEmails = {
  billing: "billing@aplime.com",
  security: "security@aplime.com",
  info: "info@aplime.com",
} as const;
