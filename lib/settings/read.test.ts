import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { key: string; value: string }[],
  cacheCalls: [] as { keyParts: string[]; tags: string[] }[],
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => Object.assign(Promise.resolve(state.rows), { where: () => Promise.resolve(state.rows) }),
    }),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keyParts: string[], options: { tags: string[] }) => {
    state.cacheCalls.push({ keyParts, tags: options.tags });
    return fn;
  },
}));

import { encryptSecret } from "@/lib/settings/crypto";
import { getSetting, getSettingsGroup, getSettingsMap, invalidateStoredSettings } from "@/lib/settings/read";

const KEY = Buffer.alloc(32, 1);

beforeEach(() => {
  state.rows = [];
  state.cacheCalls = [];
  invalidateStoredSettings();
  vi.stubEnv("SETTINGS_ENCRYPTION_KEY", KEY.toString("base64"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("settings reads", () => {
  it("caches a group under the settings and settings:<group> tags", async () => {
    state.rows = [{ key: "site_name", value: "Nimbus Linen" }];
    const store = await getSettingsGroup("store");
    expect(store.site_name).toBe("Nimbus Linen");
    expect(state.cacheCalls).toEqual([{ keyParts: ["settings-group", "store"], tags: ["settings", "settings:store"] }]);
  });

  it("keeps groups with credentials out of the Next data cache", async () => {
    state.rows = [{ key: "bkash_mode", value: "live" }];
    expect((await getSettingsGroup("payments")).bkash_mode).toBe("live");
    expect(state.cacheCalls).toEqual([]);
  });

  it("decrypts a sealed credential", async () => {
    state.rows = [{ key: "bkash_password", value: encryptSecret("hunter2", KEY, "bkash_password") }];
    expect(await getSetting("bkash_password")).toBe("hunter2");
  });

  it("returns typed values", async () => {
    state.rows = [{ key: "low_stock_threshold", value: "5" }];
    expect(await getSetting("low_stock_threshold")).toBe(5);
  });

  it("serves the legacy string map decrypted", async () => {
    state.rows = [
      { key: "site_name", value: "Nimbus Linen" },
      { key: "steadfast_api_key", value: encryptSecret("sf-key", KEY, "steadfast_api_key") },
    ];
    expect(await getSettingsMap()).toEqual({ site_name: "Nimbus Linen", steadfast_api_key: "sf-key" });
  });
});
