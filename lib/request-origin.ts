import type { Context } from "hono";

/**
 * Derives the canonical public origin (e.g. `https://test.sleepsheetbd.com`)
 * for the current request.
 *
 * Handles reverse proxies (Cloudflare, Traefik, Docker Swarm) by prioritizing
 * `x-forwarded-host` and `host`, and explicitly ignores internal container bind
 * addresses such as `0.0.0.0` or `127.0.0.1` (unless in local dev with `localhost`).
 */
export function getRequestOrigin(c: Context): string {
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = c.req.header("host")?.trim();
  const host = forwardedHost || hostHeader;

  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocalhost = Boolean(host && (host.startsWith("localhost") || host.startsWith("127.0.0.1")));
  const proto = forwardedProto || (isLocalhost ? "http" : "https");

  // Valid external host or local dev
  if (host && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  // Fallback to configured app URL from environment
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  // Last resort: extract origin from c.req.url if not 0.0.0.0
  try {
    const parsed = new URL(c.req.url);
    if (!parsed.hostname.startsWith("0.0.0.0")) {
      return parsed.origin;
    }
  } catch {
    // ignore
  }

  return "";
}
