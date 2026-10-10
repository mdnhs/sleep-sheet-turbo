import { describe, expect, it } from "vitest";
import { BUSINESS_DEFAULTS } from "@/lib/settings/defaults";
import { businessRulesFromSettings } from "@/lib/settings/business-rules";

describe("businessRulesFromSettings", () => {
  it("falls back to the defaults", () => {
    expect(businessRulesFromSettings(null)).toEqual({
      invoiceLanguage: BUSINESS_DEFAULTS.invoiceLanguage,
      defaultProductCategory: BUSINESS_DEFAULTS.defaultProductCategory,
    });
  });

  it("uses saved values", () => {
    expect(businessRulesFromSettings({ invoice_language: "en", default_product_category: "Bedsheet" })).toEqual({
      invoiceLanguage: "en",
      defaultProductCategory: "Bedsheet",
    });
  });

  it("prints Bangla invoices for anything but en", () => {
    expect(businessRulesFromSettings({ invoice_language: "fr" }).invoiceLanguage).toBe("bn");
  });

  it("opens on all products when the admin clears the default category", () => {
    expect(businessRulesFromSettings({ default_product_category: "" }).defaultProductCategory).toBe("");
  });
});
