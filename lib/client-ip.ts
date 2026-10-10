/**
 * The address a request really came from.
 *
 * Production traffic arrives through Cloudflare, which sets CF-Connecting-IP
 * itself. A client can't forge it as long as the origin only accepts
 * Cloudflare's IP ranges (deploy/README.md, "Origin firewall"). The leftmost
 * X-Forwarded-For entry, which this codebase used to trust, is whatever the
 * client chose to send. Without the Cloudflare header (local dev, or a direct
 * hit on the origin) we fall back to X-Real-IP, then to the rightmost
 * X-Forwarded-For entry: the hop our own proxy appended.
 */
export type HeaderGetter = (name: string) => string | null | undefined;

export function getClientIp(get: HeaderGetter): string | null {
  const cf = get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return null;
}
