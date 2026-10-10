import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { buildFallback } from "@/lib/build-phase";
import { cacheTag } from "@/lib/cache-tag";
import { getSettingsKey } from "@/lib/settings/crypto";
import { decryptStoredMap, parseGroup } from "@/lib/settings/parse";
import {
  SETTINGS,
  groupHasSecrets,
  keysInGroup,
  type GroupValues,
  type SettingGroup,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/registry";

// The whole table is small and changes a few times a month; the settings
// PATCH drops this snapshot the moment it writes (same process).
const SNAPSHOT_TTL_MS = 60_000;
let snapshot: { values: Record<string, string>; expiresAt: number } | null = null;

/** Every row as stored (credentials still sealed). In-process only, never on disk. */
export async function getStoredSettings(): Promise<Record<string, string>> {
  if (snapshot && snapshot.expiresAt > Date.now()) return snapshot.values;
  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  snapshot = { values, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
  return values;
}

export function invalidateStoredSettings(): void {
  snapshot = null;
}

async function loadGroupRows(group: SettingGroup): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({ key: siteSettings.key, value: siteSettings.value })
      .from(siteSettings)
      .where(inArray(siteSettings.key, keysInGroup(group)));
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    // Defaults during `next build` (no database there); a runtime failure
    // throws so unstable_cache never stores it (lib/build-phase.ts).
    return buildFallback<Record<string, string>>(error, {}, `settings group ${group}`);
  }
}

function isOutsideNextCache(error: unknown): boolean {
  return error instanceof Error && error.message.includes("incrementalCache missing");
}

async function cachedGroupRows(group: SettingGroup): Promise<Record<string, string>> {
  const read = unstable_cache(() => loadGroupRows(group), ["settings-group", group], {
    revalidate: 86400,
    tags: [cacheTag("settings"), cacheTag("settings", group)],
  });
  try {
    return await read();
  } catch (error) {
    // Scripts and tests run without Next's incremental cache.
    if (isOutsideNextCache(error)) return loadGroupRows(group);
    throw error;
  }
}

/**
 * One group, typed. A group without credentials is cached in the Next data
 * cache under `settings` and `settings:<group>`. A group holding
 * credentials is read from the in-process snapshot instead, because the
 * data cache persists to disk and, until SETTINGS_ENCRYPTION_KEY is set,
 * those rows are plaintext.
 */
export async function getSettingsGroup<G extends SettingGroup>(group: G): Promise<GroupValues<G>> {
  const stored = groupHasSecrets(group) ? await getStoredSettings() : await cachedGroupRows(group);
  return parseGroup(group, stored, getSettingsKey());
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const values = (await getSettingsGroup(SETTINGS[key].group)) as Record<string, unknown>;
  return values[key] as SettingValue<K>;
}

/** Every row decrypted, as the plain string map the pre-SP-1 readers expect. */
export async function getSettingsMap(): Promise<Record<string, string>> {
  return decryptStoredMap(await getStoredSettings(), getSettingsKey());
}
