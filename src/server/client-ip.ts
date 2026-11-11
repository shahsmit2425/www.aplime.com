import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { ipKeyGenerator } from "express-rate-limit";
import { env } from "./config.js";
export const proxyTrustSetting = env.TRUSTED_PROXY_CIDRS.trim()
  ? env.TRUSTED_PROXY_CIDRS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : env.TRUST_PROXY_HOPS;
export type TrustProxy = (ip: string, hop: number) => boolean;
// Same right-to-left trust walk used by Express. Never take CF-Connecting-IP
// or the leftmost forwarded value on faith. Invalid chains fall back to peer.
export function clientIp(
  req: IncomingMessage,
  trust: TrustProxy = () => false,
) {
  const peer = req.socket.remoteAddress || "unknown";
  const header = req.headers["x-forwarded-for"];
  if (!header || Array.isArray(header) || header.length > 2048) return peer;
  const forwarded = header
    .split(",")
    .map((v) => v.trim())
    .reverse();
  if (forwarded.length > 20) return peer;
  const chain = [peer, ...forwarded];
  let index = 0;
  while (index < chain.length - 1 && trust(chain[index], index)) {
    if (!isIP(chain[index + 1])) return chain[index];
    index++;
  }
  return chain[index];
}
export function clientNetwork(req: IncomingMessage, trust?: TrustProxy) {
  return ipKeyGenerator(clientIp(req, trust));
}
