import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SECRET_SETTING_KEYS } from "@/features/settings/secret-keys";
import {
  SETTINGS,
  SETTING_KEYS,
  groupHasSecrets,
  isSettingKey,
  keysInGroup,
  serializeSetting,
} from "@/lib/settings/registry";

// Every key the hand-written PATCH validator accepted before SP-1.
const LEGACY_KEYS = [
  "shipping_inside_dhaka", "shipping_outside_dhaka", "currency", "payment_method_card", "payment_method_cod",
  "payment_method_due", "payment_method_bkash", "social_manager_url", "bkash_mode", "bkash_app_key",
  "bkash_app_secret", "bkash_username", "bkash_password", "pos_payment_methods", "pos_facebook_pages",
  "pos_default_facebook_page", "seo_site_name", "seo_default_title", "seo_default_description",
  "seo_default_image", "seo_google_verification", "seo_bing_verification", "google_analytics_id",
  "ga4_property_id", "gtm_web_id", "gtm_server_id", "gtm_server_url", "analytics_enabled", "seo_twitter_handle",
  "seo_robots_ai_block", "cloudinary_cloud_name", "cloudinary_api_key", "cloudinary_api_secret",
  "steadfast_api_key", "steadfast_secret_key", "bdcourier_api_key", "google_sheets_client_email",
  "google_sheets_private_key", "google_sheets_spreadsheet_id", "site_name", "logo_url", "hero_title",
  "hero_subtitle", "hero_cta_text", "hero_cta_link", "hero_bg_image", "hero_slides", "promo_banners",
  "feature_1_title", "feature_1_desc", "feature_2_title", "feature_2_desc", "feature_3_title", "feature_3_desc",
  "feature_4_title", "feature_4_desc", "newsletter_title", "newsletter_subtitle", "footer_brand_desc",
  "footer_email", "footer_phone", "footer_address", "footer_address_link", "social_facebook",
  "social_instagram", "social_twitter", "social_youtube", "social_tiktok", "footer_copyright",
];

// The credentials the app already treated as secret, plus the new AI key.
// Listed by hand: SECRET_SETTING_KEYS is now derived from the registry, so
// comparing against it would be circular.
const CREDENTIALS: string[] = [
  "steadfast_api_key", "steadfast_secret_key", "bdcourier_api_key", "cloudinary_api_key",
  "cloudinary_api_secret", "google_sheets_client_email", "google_sheets_private_key",
  "google_sheets_spreadsheet_id", "bkash_app_key", "bkash_app_secret", "bkash_username",
  "bkash_password", "ai_api_key",
];

describe("settings registry", () => {
  it("accepts every key the settings forms sent before SP-1", () => {
    expect(LEGACY_KEYS.filter((key) => !isSettingKey(key))).toEqual([]);
  });

  it("rejects keys it does not declare", () => {
    expect(isSettingKey("seo_magic")).toBe(false);
    expect(isSettingKey("fraud_pathao_user")).toBe(false);
  });

  it("gives every key a default that passes its own schema", () => {
    for (const key of SETTING_KEYS) {
      const def = SETTINGS[key];
      const parsed = (def.schema as z.ZodType).safeParse(serializeSetting(def.default));
      expect(parsed.success, key).toBe(true);
      expect(parsed.data, key).toEqual(def.default);
    }
  });

  it("marks exactly the credentials as secret", () => {
    expect(SETTING_KEYS.filter((key) => SETTINGS[key].secret).sort()).toEqual([...CREDENTIALS].sort());
  });

  it("derives SECRET_SETTING_KEYS from the registry", () => {
    expect([...SECRET_SETTING_KEYS].sort()).toEqual([...CREDENTIALS].sort());
  });

  it("keeps secrets admin-only and out of the public map", () => {
    for (const key of CREDENTIALS) {
      expect(SETTINGS[key as keyof typeof SETTINGS].write, key).toBe("admin");
      expect(SETTINGS[key as keyof typeof SETTINGS].public, key).toBe(false);
    }
  });

  it("keeps the whole ai group admin-only and private", () => {
    for (const key of keysInGroup("ai")) {
      expect(SETTINGS[key].write, key).toBe("admin");
      expect(SETTINGS[key].public, key).toBe(false);
    }
  });

  it("lets settings:write change the store profile and business rules", () => {
    for (const key of [...keysInGroup("store"), ...keysInGroup("business")]) {
      expect(SETTINGS[key].write, key).toBe("settings:write");
    }
  });

  it("validates business rules", () => {
    expect(SETTINGS.order_number_prefix.schema.safeParse("ord-1").success).toBe(false);
    expect(SETTINGS.order_number_prefix.schema.safeParse("WEB").success).toBe(true);
    expect(SETTINGS.low_stock_threshold.schema.safeParse("-1").success).toBe(false);
    expect(SETTINGS.invoice_language.schema.safeParse("fr").success).toBe(false);
  });

  it("rejects an unknown time zone", () => {
    expect(SETTINGS.store_timezone.schema.safeParse("Mars/Olympus").success).toBe(false);
    expect(SETTINGS.store_timezone.schema.safeParse("Asia/Dhaka").success).toBe(true);
  });

  it("reads flags and numbers into typed values", () => {
    expect(SETTINGS.payment_method_cod.schema.parse("false")).toBe(false);
    expect(SETTINGS.shipping_inside_dhaka.schema.parse("80")).toBe(80);
  });

  it("trims the bKash credentials but leaves other secrets byte-exact", () => {
    for (const key of ["bkash_app_key", "bkash_app_secret", "bkash_username", "bkash_password"] as const) {
      expect(SETTINGS[key].schema.parse("  x \n"), key).toBe("x");
    }
    expect(SETTINGS.google_sheets_private_key.schema.parse("  x \n")).toBe("  x \n");
    expect(SETTINGS.steadfast_api_key.schema.parse("  x \n")).toBe("  x \n");
  });

  it("defaults card and due on (a missing row means enabled) and bkash off", () => {
    expect(SETTINGS.payment_method_card.default).toBe(true);
    expect(SETTINGS.payment_method_due.default).toBe(true);
    expect(SETTINGS.payment_method_cod.default).toBe(true);
    expect(SETTINGS.payment_method_bkash.default).toBe(false);
  });

  it("knows which groups hold credentials", () => {
    expect(groupHasSecrets("store")).toBe(false);
    expect(groupHasSecrets("payments")).toBe(true);
    expect(groupHasSecrets("integrations")).toBe(true);
    expect(keysInGroup("store")).toEqual(expect.arrayContaining(["site_name", "store_timezone", "footer_phone"]));
  });

  it("serializes typed values back to stored strings", () => {
    expect(serializeSetting(true)).toBe("true");
    expect(serializeSetting(150)).toBe("150");
    expect(serializeSetting("x")).toBe("x");
  });
});
