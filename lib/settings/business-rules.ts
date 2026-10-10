import { BUSINESS_DEFAULTS } from "@/lib/settings/defaults";

/** Business rules the dashboard reads from the settings map (zod-free, so client code may import it). */
export type BusinessRules = { invoiceLanguage: "bn" | "en"; defaultProductCategory: string };

export function businessRulesFromSettings(s?: Readonly<Record<string, string | undefined>> | null): BusinessRules {
  const category = s?.default_product_category;
  return {
    invoiceLanguage: s?.invoice_language === "en" ? "en" : s?.invoice_language === "bn" ? "bn" : BUSINESS_DEFAULTS.invoiceLanguage,
    // A saved empty value means "all categories"; only a never-saved one falls back.
    defaultProductCategory: category === undefined ? BUSINESS_DEFAULTS.defaultProductCategory : category.trim(),
  };
}
