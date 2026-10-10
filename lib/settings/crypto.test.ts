import { describe, expect, it } from "vitest";
import {
  SecretDecryptError,
  decryptSecret,
  encryptSecret,
  getSettingsKey,
  isEncrypted,
  parseSettingsKey,
  sealSecret,
} from "@/lib/settings/crypto";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe("settings crypto", () => {
  it("round-trips a value", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(sealed, KEY, "bkash_password")).toBe("hunter2");
  });

  it("produces a different ciphertext every time", () => {
    expect(encryptSecret("hunter2", KEY, "k")).not.toBe(encryptSecret("hunter2", KEY, "k"));
  });

  it("passes a plaintext value straight through", () => {
    expect(decryptSecret("legacy-plain", KEY, "bkash_password")).toBe("legacy-plain");
    expect(decryptSecret("legacy-plain", null, "bkash_password")).toBe("legacy-plain");
  });

  it("stores plaintext when no key is set, so the deploy is safe before the owner sets one", () => {
    expect(sealSecret("hunter2", null, "bkash_password")).toBe("hunter2");
  });

  it("leaves an empty value empty", () => {
    expect(sealSecret("", KEY, "bkash_password")).toBe("");
  });

  it("does not encrypt twice", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(sealSecret(sealed, KEY, "k")).toBe(sealed);
  });

  it("refuses a ciphertext moved to another setting", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(() => decryptSecret(sealed, KEY, "steadfast_api_key")).toThrow(SecretDecryptError);
  });

  it("refuses the wrong key", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(() => decryptSecret(sealed, OTHER_KEY, "k")).toThrow(SecretDecryptError);
  });

  it("refuses an encrypted value when the key is missing", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(() => decryptSecret(sealed, null, "k")).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it("refuses a tampered value", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered, KEY, "k")).toThrow(SecretDecryptError);
  });

  it("refuses a truncated tag or a wrong-size IV", () => {
    const [iv, tag, body] = encryptSecret("hunter2", KEY, "k").slice("enc:v1:".length).split(".");
    const shortTag = `enc:v1:${iv}.${tag.slice(0, 8)}.${body}`;
    const shortIv = `enc:v1:${iv.slice(0, 8)}.${tag}.${body}`;
    expect(() => decryptSecret(shortTag, KEY, "k")).toThrow(SecretDecryptError);
    expect(() => decryptSecret(shortIv, KEY, "k")).toThrow(SecretDecryptError);
  });

  it("recognises the stored prefix", () => {
    expect(isEncrypted("enc:v1:abc")).toBe(true);
    expect(isEncrypted("abc")).toBe(false);
  });

  it("requires a 32-byte key", () => {
    expect(() => parseSettingsKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseSettingsKey(KEY.toString("base64")).equals(KEY)).toBe(true);
  });

  it("reads the key from the environment, or null when unset", () => {
    expect(getSettingsKey({})).toBeNull();
    expect(getSettingsKey({ SETTINGS_ENCRYPTION_KEY: "  " })).toBeNull();
    expect(getSettingsKey({ SETTINGS_ENCRYPTION_KEY: KEY.toString("base64") })?.equals(KEY)).toBe(true);
  });
});
