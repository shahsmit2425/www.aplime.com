import nodemailer from "nodemailer";
import { env } from "../config.js";
import { requireValue } from "../errors.js";
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  messageId?: string,
) {
  requireValue(
    env.SMTP_USER &&
      env.SMTP_FROM &&
      env.MICROSOFT_TENANT_ID &&
      env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET,
    "Email is not configured.",
  );
  const response = await fetch(
    "https://login.microsoftonline.com/" +
      encodeURIComponent(env.MICROSOFT_TENANT_ID) +
      "/oauth2/v2.0/token",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.MICROSOFT_CLIENT_ID,
        client_secret: env.MICROSOFT_CLIENT_SECRET,
        scope: "https://outlook.office365.com/.default",
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error("Microsoft OAuth token request failed.");
  const { access_token } = await response.json();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    requireTLS: true,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: "TLSv1.2" },
    auth: { type: "OAuth2", user: env.SMTP_USER, accessToken: access_token },
    connectionTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html,
      messageId,
    });
  } finally {
    transport.close();
  }
}
