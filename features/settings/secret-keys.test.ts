import { describe, expect, it } from "vitest";
import { isSecretKey, secretKeysIn } from "@/features/settings/secret-keys";

describe("isSecretKey", () => {
  it("flags every listed credential", () => {
    for (const key of [
      "bkash_app_secret",
      "bkash_password",
      "steadfast_api_key",
      "cloudinary_api_secret",
      "google_sheets_private_key",
      "google_sheets_spreadsheet_id",
    ]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("flags credential-shaped keys that aren't listed", () => {
    expect(isSecretKey("fraud_pathao_user")).toBe(true);
    expect(isSecretKey("sms_api_token")).toBe(true);
  });

  it("leaves ordinary settings alone", () => {
    expect(isSecretKey("site_name")).toBe(false);
    expect(isSecretKey("shipping_inside_dhaka")).toBe(false);
  });
});

describe("secretKeysIn", () => {
  it("returns only the secret keys", () => {
    expect(secretKeysIn(["site_name", "bkash_app_secret", "currency"])).toEqual(["bkash_app_secret"]);
  });

  it("returns nothing for ordinary settings", () => {
    expect(secretKeysIn(["site_name", "currency", "shipping_outside_dhaka"])).toEqual([]);
  });
});
