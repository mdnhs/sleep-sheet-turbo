import { db } from "@/db";
import { siteSettings } from "@/db/schema";

// Store settings change rarely but are read on hot paths — every checkout
// looked up its shipping cost and payment-method flag with a separate query.
// The whole table is small, so one cached snapshot serves every lookup.
const TTL_MS = 60_000;

let cache: { values: Record<string, string>; expiresAt: number } | null = null;

/** All site settings as a key → value map, cached in-process for TTL_MS. */
export async function getSettingsMap(): Promise<Record<string, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.values;

  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  cache = { values, expiresAt: Date.now() + TTL_MS };
  return values;
}

/** One setting, or `fallback` when it isn't set. */
export async function getSetting(key: string, fallback?: string): Promise<string | undefined> {
  const values = await getSettingsMap();
  return values[key] ?? fallback;
}

/** Drop the cached snapshot — call after writing settings. */
export function invalidateSettingsCache(): void {
  cache = null;
}
