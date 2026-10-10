import { SETTINGS, SETTING_KEYS } from "@/lib/settings/registry";

/**
 * The unauthenticated settings map: every registered public key as stored,
 * plus a `<key>_set` flag per credential so the admin UI can show
 * configured state. Credentials, private keys (the ai group) and rows the
 * registry doesn't know (orphaned fraud_* logins) are never served.
 */
export function publicSettingsMap(rows: { key: string; value: string }[]): Record<string, string> {
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const map: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const def = SETTINGS[key];
    if (def.secret) {
      map[`${key}_set`] = stored[key] ? "true" : "false";
      continue;
    }
    if (def.public && stored[key] !== undefined) map[key] = stored[key];
  }
  return map;
}
