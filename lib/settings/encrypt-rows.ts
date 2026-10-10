import { SETTINGS, isSettingKey } from "@/lib/settings/registry";
import { encryptSecret, isEncrypted } from "@/lib/settings/crypto";

export type StoredRow = { key: string; value: string };

/** The rows the one-off backfill rewrites: registered credentials still stored as plaintext. */
export function planEncryption(rows: StoredRow[], key: Buffer): StoredRow[] {
  return rows
    .filter((row) => isSettingKey(row.key) && SETTINGS[row.key].secret && row.value !== "" && !isEncrypted(row.value))
    .map((row) => ({ key: row.key, value: encryptSecret(row.value, key, row.key) }));
}
