import { describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/settings/crypto";
import { decryptStoredMap, parseGroup, readSettingValue } from "@/lib/settings/parse";
import { STORE_DEFAULTS } from "@/lib/settings/defaults";

const KEY = Buffer.alloc(32, 4);

describe("readSettingValue", () => {
  it("falls back to the default when the row is missing or empty", () => {
    expect(readSettingValue("site_name", undefined, null)).toBe(STORE_DEFAULTS.name);
    expect(readSettingValue("site_name", "", null)).toBe(STORE_DEFAULTS.name);
  });

  it("parses typed values", () => {
    expect(readSettingValue("payment_method_cod", "false", null)).toBe(false);
    expect(readSettingValue("low_stock_threshold", "5", null)).toBe(5);
  });

  it("falls back on an invalid stored value and logs only the key", () => {
    const log = vi.fn();
    expect(readSettingValue("invoice_language", "fr", null, log)).toBe("bn");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("invoice_language"));
    expect(log.mock.calls[0][0]).not.toContain("fr");
  });

  it("decrypts a sealed credential", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(readSettingValue("bkash_password", sealed, KEY)).toBe("hunter2");
  });

  it("reads a credential saved before encryption existed", () => {
    expect(readSettingValue("bkash_password", "hunter2", KEY)).toBe("hunter2");
    expect(readSettingValue("bkash_password", "hunter2", null)).toBe("hunter2");
  });

  it("treats an unreadable credential as unset without logging its value", () => {
    const log = vi.fn();
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(readSettingValue("bkash_password", sealed, null, log)).toBe("");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bkash_password"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("hunter2");
  });
});

describe("parseGroup", () => {
  it("returns every key of the group and nothing else", () => {
    const store = parseGroup("store", { site_name: "Nimbus Linen", bkash_password: "x" }, null);
    expect(store.site_name).toBe("Nimbus Linen");
    expect(store.store_timezone).toBe(STORE_DEFAULTS.timezone);
    expect("bkash_password" in store).toBe(false);
  });
});

describe("decryptStoredMap", () => {
  it("decrypts sealed rows and blanks the ones it cannot read", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    const log = vi.fn();
    expect(decryptStoredMap({ bkash_password: sealed, site_name: "A" }, KEY, log)).toEqual({
      bkash_password: "hunter2",
      site_name: "A",
    });
    expect(decryptStoredMap({ bkash_password: sealed }, null, log)).toEqual({ bkash_password: "" });
  });
});
