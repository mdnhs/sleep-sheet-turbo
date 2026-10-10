import { describe, expect, it } from "vitest";
import { SEO_DEFAULTS } from "@/lib/settings/defaults";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
import { buildRootMetadata } from "@/lib/seo/root-metadata";

const store = storeProfileFromSettings({ site_name: "Nimbus Linen" });
const URL_BASE = "https://nimbus.example";

describe("buildRootMetadata", () => {
  it("puts the store name in the title template", () => {
    const meta = buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE);
    expect(meta.title).toEqual({ default: SEO_DEFAULTS.title, template: "%s | Nimbus Linen" });
    expect(meta.applicationName).toBe("Nimbus Linen");
    expect(meta.openGraph?.siteName).toBe("Nimbus Linen");
  });

  it("falls back to the built-in title when none is saved", () => {
    expect(buildRootMetadata(store, siteSeoFromSettings(null), URL_BASE).description).toBe(SEO_DEFAULTS.description);
  });

  it("uses the saved default title and description", () => {
    const meta = buildRootMetadata(
      store,
      siteSeoFromSettings({ seo_default_title: "Linen for every bed", seo_default_description: "Soft sheets." }),
      URL_BASE,
    );
    expect(meta.title).toEqual({ default: "Linen for every bed", template: "%s | Nimbus Linen" });
    expect(meta.description).toBe("Soft sheets.");
  });

  it("does not template og:title or twitter:title", () => {
    const meta = buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE);
    expect(typeof meta.openGraph?.title).toBe("string");
    expect(typeof meta.twitter?.title).toBe("string");
  });

  it("renders verification tags on the server", () => {
    const meta = buildRootMetadata(
      store,
      siteSeoFromSettings({ seo_google_verification: "g-123", seo_bing_verification: "b-456" }),
      URL_BASE,
    );
    expect(meta.verification).toEqual({ google: "g-123", other: { "msvalidate.01": "b-456" } });
  });

  it("sets twitter:site only when a handle is saved", () => {
    expect(buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE).twitter).not.toHaveProperty("site");
    expect(
      buildRootMetadata(store, siteSeoFromSettings({ seo_twitter_handle: "@nimbus" }), URL_BASE).twitter,
    ).toMatchObject({ site: "@nimbus" });
  });
});
