import type { z } from "zod";
import {
  SETTINGS,
  keysInGroup,
  type GroupValues,
  type SettingGroup,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/registry";
import { SecretDecryptError, decryptSecret, isEncrypted } from "@/lib/settings/crypto";

type Log = (message: string) => void;
const defaultLog: Log = (message) => console.error(message);

const reason = (error: unknown) => (error instanceof SecretDecryptError ? error.message : "decrypt failed");

/**
 * Stored text → typed value. A missing or empty row, an unreadable
 * credential and an invalid value all fall back to the registry default.
 * Logs name the key only, never the value.
 */
export function readSettingValue<K extends SettingKey>(
  key: K,
  stored: string | undefined,
  encKey: Buffer | null,
  log: Log = defaultLog,
): SettingValue<K> {
  const def = SETTINGS[key];
  const fallback = def.default as SettingValue<K>;
  if (stored === undefined || stored === "") return fallback;

  let raw = stored;
  if (def.secret || isEncrypted(stored)) {
    try {
      raw = decryptSecret(stored, encKey, key);
    } catch (error) {
      log(`[settings] cannot read ${key}: ${reason(error)}`);
      return fallback;
    }
  }

  // Cast: calling safeParse on the union of every schema type doesn't type-check.
  const parsed = (def.schema as z.ZodType).safeParse(raw);
  if (!parsed.success) {
    log(`[settings] ${key} holds an invalid value; using the default`);
    return fallback;
  }
  return parsed.data as SettingValue<K>;
}

export function parseGroup<G extends SettingGroup>(
  group: G,
  stored: Record<string, string>,
  encKey: Buffer | null,
  log: Log = defaultLog,
): GroupValues<G> {
  const values: Record<string, unknown> = {};
  for (const key of keysInGroup(group)) values[key] = readSettingValue(key, stored[key], encKey, log);
  return values as GroupValues<G>;
}

/** Every row, decrypted, in the legacy string-map shape. An unreadable credential comes back "" ("not configured"). */
export function decryptStoredMap(
  stored: Record<string, string>,
  encKey: Buffer | null,
  log: Log = defaultLog,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!isEncrypted(value)) {
      out[key] = value;
      continue;
    }
    try {
      out[key] = decryptSecret(value, encKey, key);
    } catch (error) {
      log(`[settings] cannot read ${key}: ${reason(error)}`);
      out[key] = "";
    }
  }
  return out;
}
