import { describe, expect, it } from "vitest";
import { SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";
import { fillStore, siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";

describe("storeProfileFromSettings", () => {
  it("falls back to the defaults when settings are unavailable", () => {
    const store = storeProfileFromSettings(null);
    expect(store.name).toBe(STORE_DEFAULTS.name);
    expect(store.phone).toBe(STORE_DEFAULTS.phone);
    expect(store.sameAs).toEqual([STORE_DEFAULTS.social.facebook, STORE_DEFAULTS.social.instagram]);
  });

  it("uses saved values", () => {
    const store = storeProfileFromSettings({ site_name: "Nimbus Linen", footer_phone: "+8801700000000", store_city: "Chattogram" });
    expect(store).toMatchObject({ name: "Nimbus Linen", phone: "+8801700000000", city: "Chattogram" });
  });

  it("never shows an empty store name", () => {
    expect(storeProfileFromSettings({ site_name: "  " }).name).toBe(STORE_DEFAULTS.name);
  });

  it("drops a social link the admin cleared", () => {
    const store = storeProfileFromSettings({ social_instagram: "" });
    expect(store.social.instagram).toBe("");
    expect(store.sameAs).toEqual([STORE_DEFAULTS.social.facebook]);
  });

  it("defaults the legal name to the store name", () => {
    expect(storeProfileFromSettings({ site_name: "Nimbus Linen" }).legalName).toBe("Nimbus Linen");
  });

  it("never falls back to a placeholder brand", () => {
    expect(JSON.stringify(storeProfileFromSettings({}))).not.toMatch(/LUXSTORE|LUXESTORE/i);
  });
});

describe("siteSeoFromSettings", () => {
  it("falls back to the built-in title and description", () => {
    expect(siteSeoFromSettings(null)).toMatchObject({ title: SEO_DEFAULTS.title, description: SEO_DEFAULTS.description });
  });

  it("blocks AI training crawlers unless switched off", () => {
    expect(siteSeoFromSettings({}).blockAiTraining).toBe(true);
    expect(siteSeoFromSettings({ seo_robots_ai_block: "false" }).blockAiTraining).toBe(false);
  });
});

describe("fillStore", () => {
  const store = { name: "Nimbus Linen", nameBn: "নিম্বাস লিনেন" };

  it("fills the English name by default", () => {
    expect(fillStore("About {store}", store)).toBe("About Nimbus Linen");
  });

  it("fills the Bangla name in Bangla copy", () => {
    expect(fillStore("{store} সম্পর্কে", store, "bn")).toBe("নিম্বাস লিনেন সম্পর্কে");
  });

  it("keeps $ patterns in an admin-entered name literal", () => {
    expect(fillStore("About {store}", { name: "Cash$&Carry", nameBn: "x" })).toBe("About Cash$&Carry");
    expect(fillStore("{store} / {store}", { name: "A$'B$`C$1", nameBn: "x" })).toBe("A$'B$`C$1 / A$'B$`C$1");
  });
});
