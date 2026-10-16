import { env } from "./config.js";
import type { EmailTarget } from "../shared/email-alerts.js";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function eventEmail(
  title: string,
  body: string,
  target?: EmailTarget,
  role = "customer",
) {
  const allowed = [
    "dashboard",
    "project",
    "messages",
    "schedule",
    "subscription",
    "verification",
    "profile",
    "reviews",
    "settings",
    "leads",
    "notifications",
    "help",
    "availability",
  ];
  const page =
    target && allowed.includes(target.page) ? target.page : "dashboard";
  // Authentication is still required; no signed room, Stripe or identity links in email.
  const url =
    role === "admin" || title === "Account deleted"
      ? null
      : env.SITE_URL.replace(/\/$/, "") +
        "/app/" +
        page +
        (target?.id && ["project", "messages"].includes(page)
          ? "/" + encodeURIComponent(target.id)
          : "");
  const text =
    title +
    "\n\n" +
    body +
    (url
      ? "\n\nView update: " + url
      : role === "admin"
        ? "\n\nSign in to Aplime Administration to review this update."
        : "") +
    "\n\nAplime · Home services made simple\nManage optional email alerts in Settings. Aplime does not collect payments for home services.";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#17372d"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" style="max-width:580px;background:white;border:1px solid #d5e3da;border-radius:16px"><tr><td style="padding:32px"><p style="color:#087747;font-size:25px;font-weight:bold">Aplime</p><h1 style="font-size:24px;line-height:1.35">${escape(title)}</h1><p style="font-size:17px;line-height:1.65;white-space:pre-line">${escape(body)}</p>${url ? `<p style="padding:16px 0"><a href="${escape(url)}" style="display:inline-block;background:#087747;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View update</a></p>` : role === "admin" ? "<p>Sign in to Aplime Administration to review this update.</p>" : ""}<hr style="border:0;border-top:1px solid #d5e3da"><p style="font-size:13px;line-height:1.6;color:#52675d">Home services made simple.<br>Manage optional email alerts in Settings. Essential account and billing notices may still be sent.<br>Aplime does not collect payments for home services.</p></td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
