import type { SettingKey } from "@/lib/settings/registry";
import { BUSINESS_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

export type SettingsField = {
  key: SettingKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** "" is not a valid value (the server rejects it, or coerces it to 0): the field cannot be cleared, only changed. */
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type SettingsSection = { title: string; description?: string; fields: SettingsField[] };

// The store name, logo, phone, email, address and social links are edited
// on the Website page (they predate SP-1); these are the fields SP-1 adds.
export const STORE_PROFILE_SECTIONS: SettingsSection[] = [
  {
    title: "Identity",
    description: "Used in page titles, structured data, invoices and the share card.",
    fields: [
      { key: "store_name_bn", label: "Store name (Bangla)", placeholder: STORE_DEFAULTS.nameBn },
      { key: "store_legal_name", label: "Legal name", placeholder: "As on the trade licence" },
      { key: "store_description", label: "Short description", placeholder: STORE_DEFAULTS.description, multiline: true },
      { key: "store_founding_year", label: "Founded (year)", placeholder: STORE_DEFAULTS.foundingYear },
    ],
  },
  {
    title: "Location",
    description: "The street address is on the Website page, under Footer.",
    fields: [
      { key: "store_city", label: "City", placeholder: STORE_DEFAULTS.city },
      { key: "store_postal_code", label: "Postal code", placeholder: STORE_DEFAULTS.postalCode },
    ],
  },
  {
    title: "Registration",
    fields: [
      { key: "store_dbid", label: "DBID" },
      { key: "store_trade_licence", label: "Trade licence no." },
      { key: "store_bin", label: "BIN (VAT registration)" },
    ],
  },
  {
    title: "Locale",
    fields: [
      {
        key: "store_locale",
        label: "Language and region",
        required: true,
        options: [
          { value: "bn_BD", label: "Bangla (Bangladesh)" },
          { value: "en_US", label: "English" },
        ],
      },
      { key: "store_timezone", label: "Time zone", required: true, placeholder: STORE_DEFAULTS.timezone },
    ],
  },
];

export const BUSINESS_RULE_SECTIONS: SettingsSection[] = [
  {
    title: "Orders",
    description: "New order numbers look like PREFIX-DDMMYY-XXXXXX. Existing numbers never change.",
    fields: [
      { key: "order_number_prefix", label: "Website order prefix", required: true, placeholder: BUSINESS_DEFAULTS.orderNumberPrefix },
      { key: "pos_order_number_prefix", label: "POS order prefix", required: true, placeholder: BUSINESS_DEFAULTS.posOrderNumberPrefix },
      {
        key: "invoice_language",
        label: "Invoice language (dashboard prints)",
        required: true,
        options: [
          { value: "bn", label: "বাংলা" },
          { value: "en", label: "English" },
        ],
      },
    ],
  },
  {
    title: "Inventory",
    fields: [
      { key: "low_stock_threshold", label: "Low-stock alert at or below", required: true, placeholder: String(BUSINESS_DEFAULTS.lowStockThreshold) },
      {
        key: "default_product_category",
        label: "Products page opens on category",
        placeholder: BUSINESS_DEFAULTS.defaultProductCategory,
      },
    ],
  },
];

/**
 * The fields whose trimmed value differs from what is stored. GET /api/settings
 * returns only stored rows and the server validates every submitted value, so
 * sending untouched blanks would reject the whole save (or save a coerced 0).
 */
export function toSettingsPatch(
  fields: readonly SettingsField[],
  values: Record<string, string>,
  stored: Record<string, string | undefined> = {},
): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const field of fields) {
    const next = (values[field.key] ?? "").trim();
    if (next !== (stored[field.key] ?? "").trim()) patch[field.key] = next;
  }
  return patch;
}

/** Keys in a patch that clear a field which cannot be empty. */
export function blankRequiredKeys(fields: readonly SettingsField[], patch: Record<string, string>): string[] {
  return fields.filter((field) => field.required && patch[field.key] === "").map((field) => field.key);
}
