import { SETTINGS, SETTING_KEYS, type SecretSettingKey } from "@/lib/settings/registry";

// Credentials, from the registry: never served by the public GET (only a
// "<key>_set" flag), readable through the ADMIN-only /secrets endpoint,
// writable by ADMIN only.
export const SECRET_SETTING_KEYS: readonly SecretSettingKey[] = SETTING_KEYS.filter(
  (key): key is SecretSettingKey => SETTINGS[key].secret,
);

// Safety net for credential-shaped rows that aren't in the list above (the
// DB contains orphaned logins like fraud_steadfast_* / fraud_pathao_* from
// older versions). Anything matching this is treated as a secret too.
const SECRET_KEY_PATTERN = /password|secret|api_key|token|_pass$|^fraud_/i;

export const isSecretKey = (key: string) =>
  (SECRET_SETTING_KEYS as readonly string[]).includes(key) ||
  SECRET_KEY_PATTERN.test(key);

/** The secret keys among `keys`, in their original order. */
export function secretKeysIn(keys: readonly string[]): string[] {
  return keys.filter(isSecretKey);
}
