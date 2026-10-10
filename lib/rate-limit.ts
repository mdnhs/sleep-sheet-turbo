import { createMiddleware } from "hono/factory";

/**
 * Per-IP sliding-window rate limit. In-process, same tradeoff as the session
 * cache in lib/session-middleware.ts: it resets on cold start and isn't
 * shared across instances, but it's what's available without adding a Redis
 * dependency, and it still stops the common case — a script hammering one
 * warm instance. Login/register/checkout had no rate limiting at all before
 * this (the per-account lockout in features/auth/server/route.ts only kicks
 * in after 5 wrong passwords on a KNOWN account; it does nothing against
 * enumeration across many emails or checkout/order spam).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup so this map doesn't grow unbounded on a
    // long-lived instance — piggybacks on a request that's already paying
    // for a Map write, no separate timer needed.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

/** Hono middleware: `limit` requests per `windowMs` per client IP, scoped by `name`. */
export function rateLimit(name: string, limit: number, windowMs: number) {
  return createMiddleware(async (c, next) => {
    const key = `${name}:${clientIp(c)}`;
    if (!hit(key, limit, windowMs)) {
      return c.json({ message: "Too many requests. Please try again later." }, 429);
    }
    await next();
  });
}
