// Compatibility facade over lib/settings/read.ts. Kept because
// features/web-analytics/server/store.ts (owned by a parallel session)
// imports getSetting from here. New code should use getSetting /
// getSettingsGroup from @/lib/settings/read, which are typed.
import { getSettingsMap, invalidateStoredSettings } from "@/lib/settings/read";

export { getSettingsMap };

/** One setting as stored text (decrypted), or `fallback` when it isn't set. */
export async function getSetting(key: string, fallback?: string): Promise<string | undefined> {
  const values = await getSettingsMap();
  return values[key] ?? fallback;
}

/** Drop the cached snapshot. Call after writing settings. */
export function invalidateSettingsCache(): void {
  invalidateStoredSettings();
}
