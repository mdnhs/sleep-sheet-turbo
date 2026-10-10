import { SETTINGS, SETTING_KEYS, type SecretSettingKey } from "@/lib/settings/registry";

// Credentials, from the registry: never served by the public GET (only a
// "<key>_set" flag), readable through the ADMIN-only /secrets endpoint,
// writable by ADMIN only.
export const SECRET_SETTING_KEYS: readonly SecretSettingKey[] = SETTING_KEYS.filter(
  (key): key is SecretSettingKey => SETTINGS[key].secret,
);
