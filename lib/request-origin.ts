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
  return originFrom((name) => c.req.header(name), c.req.url);
}

/**
 * Same as `getRequestOrigin`, for Next.js route handlers (`NextRequest` /
 * `Request`). Use this instead of `req.nextUrl.origin`: in the standalone
 * server (HOSTNAME=0.0.0.0) Next builds the request URL from its bind address,
 * so `nextUrl.origin` is `http://0.0.0.0:3000` behind the reverse proxy.
 */
export function getPublicOrigin(req: Request): string {
  const header = (name: string) => req.headers.get(name) ?? undefined;
  // In production the app always sits behind the reverse proxy. If it did not
  // forward the public host, the Host header is the internal one, so trust the
  // configured public URL rather than guess from it.
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.NODE_ENV === "production" && envUrl && !header("x-forwarded-host")) {
    return envUrl.replace(/\/+$/, "");
  }
  return originFrom(header, req.url);
}

function originFrom(header: (name: string) => string | undefined, requestUrl: string): string {
  const forwardedHost = header("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = header("host")?.trim();
  const host = forwardedHost || hostHeader;

  const forwardedProto = header("x-forwarded-proto")?.split(",")[0]?.trim();
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
    const parsed = new URL(requestUrl);
    if (!parsed.hostname.startsWith("0.0.0.0")) {
      return parsed.origin;
    }
  } catch {
    // ignore
  }

  return "";
}
