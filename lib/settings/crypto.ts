import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Credentials in site_settings are sealed with AES-256-GCM under
 * SETTINGS_ENCRYPTION_KEY and stored as `enc:v1:<iv>.<tag>.<ciphertext>`
 * (base64url). The setting key is the additional authenticated data, so a
 * ciphertext copied onto another row does not decrypt.
 *
 * Deploy-safe by design: with no key set, writes stay plaintext and
 * plaintext rows read as-is, so production keeps working until the owner
 * sets the key and runs scripts/encrypt-settings.ts. Never log a value
 * handled here — only key names.
 */
export const SECRET_PREFIX = "enc:v1:";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretDecryptError";
  }
}

export function parseSettingsKey(raw: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}); generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function isValidSettingsKey(raw: string): boolean {
  try {
    parseSettingsKey(raw);
    return true;
  } catch {
    return false;
  }
}

let memo: { raw: string; key: Buffer } | null = null;

export function getSettingsKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (memo?.raw !== raw) memo = { raw, key: parseSettingsKey(raw) };
  return memo.key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptSecret(stored: string, key: Buffer | null, aad: string): string {
  if (!isEncrypted(stored)) return stored;
  if (!key) throw new SecretDecryptError("value is encrypted but SETTINGS_ENCRYPTION_KEY is not set");
  const parts = stored.slice(SECRET_PREFIX.length).split(".");
  if (parts.length !== 3) throw new SecretDecryptError("malformed encrypted value");
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, "base64url"));
  // Pin both lengths: GCM accepts shortened tags and other IV sizes, which weakens the check.
  if (iv.length !== IV_BYTES) throw new SecretDecryptError("malformed encrypted value");
  if (tag.length !== TAG_BYTES) throw new SecretDecryptError("malformed encrypted value");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretDecryptError("wrong key, or the value was altered");
  }
}

/** What to store for a credential: sealed when a key is set, otherwise as typed. */
export function sealSecret(plain: string, key: Buffer | null, aad: string): string {
  if (plain === "" || key === null || isEncrypted(plain)) return plain;
  return encryptSecret(plain, key, aad);
}
