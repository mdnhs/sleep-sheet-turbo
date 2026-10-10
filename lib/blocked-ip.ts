import { db } from "@/db";
import { blockedIps } from "@/db/schema";
import { eq } from "drizzle-orm";

/** The client IP a request came from, as stored on orders. */
export function clientIpFromHeaders(headers: {
  get?: (name: string) => string | null;
}): string | null {
  const get = (n: string) => headers.get?.(n) ?? null;
  return get("x-forwarded-for")?.split(",")[0]?.trim() || get("x-real-ip") || null;
}

/** True when this IP has been blocked from ordering. Null/unknown IP is never blocked. */
export async function isIpBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const hit = await db.query.blockedIps.findFirst({
    where: eq(blockedIps.ipAddress, ip),
    columns: { id: true },
  });
  return Boolean(hit);
}
