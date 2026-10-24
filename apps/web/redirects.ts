import type { RequestHandler } from "express";
export function canonicalRedirect(
  site: URL,
  production: boolean,
): RequestHandler {
  return (req, res, next) => {
    // Reject authority-like, backslash and control-character paths before any redirect.
    // Also check decoded input to cover browser/proxy normalization differences.
    const raw = req.originalUrl.split("?")[0];
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      res.status(400).send("Invalid URL");
      return;
    }
    if (
      [raw, decoded].some(
        (p) =>
          !p.startsWith("/") ||
          p.startsWith("//") ||
          /[\\\x00-\x20\x7f]/.test(p),
      )
    ) {
      res.status(400).send("Invalid URL");
      return;
    }
    const trimmed =
      raw.length > 1 && raw.endsWith("/")
        ? raw.replace(/\/+$/, "") || "/"
        : raw;
    const suffix = req.originalUrl.slice(raw.length);
    if (
      production &&
      ["GET", "HEAD"].includes(req.method) &&
      req.get("host") !== site.host
    ) {
      res.redirect(308, site.origin + trimmed + suffix);
      return;
    }
    if (trimmed !== raw) {
      res.redirect(308, trimmed + suffix);
      return;
    }
    next();
  };
}
