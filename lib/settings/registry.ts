import { z } from "zod";
import { SHIPPING_ZONES } from "@/features/checkout/constants";
import { isValidSocialManagerUrl } from "@/lib/social-manager";
import { BUSINESS_DEFAULTS, SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

/**
 * Every key in site_settings, typed (brief §4, SP-1 "Registry").
 *
 * - group: the cache unit (tags `settings` + `settings:<group>`).
 * - schema: validates a PATCH value and parses a stored string into its
 *   typed value. Values are still stored as text.
 * - default: used when the row is missing or empty.
 * - secret: sealed at rest (lib/settings/crypto.ts), never served by the
 *   public GET (only a `<key>_set` flag), readable by ADMIN only.
 * - public: served by the unauthenticated GET /api/settings.
 * - write: "admin" keys are refused (403) for anyone below ADMIN.
 *
 * Server and admin code only: this module imports zod. Client code may use
 * `import type` from it, never a value import.
 */
export const SETTING_GROUPS = [
  "store", "seo", "tracking", "checkout", "payments", "integrations", "pos", "content", "business", "ai",
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];
export type WritePermission = "settings:write" | "admin";

export type SettingDef<
  G extends SettingGroup = SettingGroup,
  S extends z.ZodType = z.ZodType,
  Secret extends boolean = boolean,
> = {
  group: G;
  schema: S;
  default: z.output<S>;
  secret: Secret;
  public: boolean;
  write: WritePermission;
};

function plain<G extends SettingGroup, S extends z.ZodType>(
  group: G,
  schema: S,
  defaultValue: z.output<S>,
  options: { public?: boolean; write?: WritePermission } = {},
): SettingDef<G, S, false> {
  return {
    group,
    schema,
    default: defaultValue,
    secret: false,
    public: options.public ?? true,
    write: options.write ?? "settings:write",
  };
}

// Not trimmed: a pasted PEM private key keeps its exact bytes.
const secretText = z.string().max(10_000);

// The bKash credentials were trimmed by the legacy PATCH validator; keep that.
const trimmedSecretText = z.string().trim().max(10_000);

function secret<G extends SettingGroup>(group: G): SettingDef<G, typeof secretText, true>;
function secret<G extends SettingGroup>(
  group: G,
  options: { trim: true },
): SettingDef<G, typeof trimmedSecretText, true>;
function secret<G extends SettingGroup>(group: G, options?: { trim?: boolean }) {
  return {
    group,
    schema: options?.trim ? trimmedSecretText : secretText,
    default: "",
    secret: true,
    public: false,
    write: "admin",
  };
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const text = z.string().trim().max(2_000);
// hero_slides / promo_banners / pos_* hold JSON written by the admin managers.
const longText = z.string().max(200_000);
const flag = z.enum(["true", "false"]).transform((value) => value === "true");
const amount = z.coerce.number().min(0);
const count = z.coerce.number().int().min(0).max(1_000_000);
const httpUrl = z.string().trim().refine(isValidSocialManagerUrl, "Must be an http(s) URL");
const timeZone = z.string().trim().refine(isTimeZone, "Unknown time zone");
const year = z.string().trim().regex(/^(\d{4})?$/, "A four-digit year");
const prefix = z.string().trim().regex(/^[A-Z0-9]{2,6}$/, "2–6 capital letters or digits");

const adminOnly = { public: false, write: "admin" } as const;

export const SETTINGS = {
  // ── store: the store profile (brief §4, SP-1 "Store profile store.*").
  // Pre-SP-1 keys keep their names (site_name, footer_*, social_*), so no
  // stored row moves; new fields use a store_ prefix.
  site_name: plain("store", text, STORE_DEFAULTS.name),
  store_name_bn: plain("store", text, STORE_DEFAULTS.nameBn),
  store_legal_name: plain("store", text, STORE_DEFAULTS.legalName),
  logo_url: plain("store", text, STORE_DEFAULTS.logoUrl),
  footer_phone: plain("store", text, STORE_DEFAULTS.phone),
  footer_email: plain("store", text, STORE_DEFAULTS.email),
  footer_address: plain("store", text, STORE_DEFAULTS.address),
  footer_address_link: plain("store", text, STORE_DEFAULTS.addressLink),
  store_city: plain("store", text, STORE_DEFAULTS.city),
  store_postal_code: plain("store", text, STORE_DEFAULTS.postalCode),
  store_dbid: plain("store", text, STORE_DEFAULTS.dbid),
  store_trade_licence: plain("store", text, STORE_DEFAULTS.tradeLicence),
  store_bin: plain("store", text, STORE_DEFAULTS.bin),
  store_locale: plain("store", z.enum(["bn_BD", "en_US"]), STORE_DEFAULTS.locale),
  store_timezone: plain("store", timeZone, STORE_DEFAULTS.timezone),
  store_description: plain("store", text, STORE_DEFAULTS.description),
  store_founding_year: plain("store", year, STORE_DEFAULTS.foundingYear),
  social_facebook: plain("store", text, STORE_DEFAULTS.social.facebook),
  social_instagram: plain("store", text, STORE_DEFAULTS.social.instagram),
  social_twitter: plain("store", text, STORE_DEFAULTS.social.twitter),
  social_youtube: plain("store", text, STORE_DEFAULTS.social.youtube),
  social_tiktok: plain("store", text, STORE_DEFAULTS.social.tiktok),

  // ── seo
  seo_site_name: plain("seo", text, STORE_DEFAULTS.name), // dead: removed in Task 12
  seo_default_title: plain("seo", text, SEO_DEFAULTS.title),
  seo_default_description: plain("seo", text, SEO_DEFAULTS.description),
  seo_default_image: plain("seo", text, SEO_DEFAULTS.image),
  seo_google_verification: plain("seo", text, ""),
  seo_bing_verification: plain("seo", text, ""),
  seo_twitter_handle: plain("seo", text, ""),
  seo_robots_ai_block: plain("seo", flag, true),

  // ── tracking
  google_analytics_id: plain("tracking", text, ""), // dead: removed in Task 12
  ga4_property_id: plain("tracking", text, ""), // dead: removed in Task 12
  gtm_web_id: plain("tracking", text, ""),
  gtm_server_id: plain("tracking", text, ""), // dead: removed in Task 12
  gtm_server_url: plain("tracking", httpUrl, ""),
  // First-party web analytics on/off (features/web-analytics). Missing means on.
  analytics_enabled: plain("tracking", flag, true),

  // ── checkout
  shipping_inside_dhaka: plain("checkout", amount, SHIPPING_ZONES.inside_dhaka.cost),
  shipping_outside_dhaka: plain("checkout", amount, SHIPPING_ZONES.outside_dhaka.cost),
  currency: plain("checkout", z.string().trim().min(1).max(10), "BDT"),
  // Card and due default on: a missing row has always meant enabled (POS, settings UI).
  payment_method_card: plain("checkout", flag, true),
  payment_method_cod: plain("checkout", flag, true),
  payment_method_due: plain("checkout", flag, true),
  payment_method_bkash: plain("checkout", flag, false),

  // ── payments
  bkash_mode: plain("payments", z.enum(["sandbox", "live"]), "sandbox"),
  bkash_app_key: secret("payments", { trim: true }),
  bkash_app_secret: secret("payments", { trim: true }),
  bkash_username: secret("payments", { trim: true }),
  bkash_password: secret("payments", { trim: true }),

  // ── integrations (cloudinary_cloud_name is public: it is in every image URL)
  cloudinary_cloud_name: plain("integrations", text, ""),
  cloudinary_api_key: secret("integrations"),
  cloudinary_api_secret: secret("integrations"),
  steadfast_api_key: secret("integrations"),
  steadfast_secret_key: secret("integrations"),
  bdcourier_api_key: secret("integrations"),
  google_sheets_client_email: secret("integrations"),
  google_sheets_private_key: secret("integrations"),
  google_sheets_spreadsheet_id: secret("integrations"),
  // http(s) only, so the admin sidebar link can never be javascript:.
  social_manager_url: plain("integrations", httpUrl, ""),

  // ── pos
  pos_payment_methods: plain("pos", longText, ""),
  pos_facebook_pages: plain("pos", longText, ""),
  pos_default_facebook_page: plain("pos", text, ""),

  // ── content (homepage and footer copy)
  hero_title: plain("content", text, ""),
  hero_subtitle: plain("content", text, ""),
  hero_cta_text: plain("content", text, ""),
  hero_cta_link: plain("content", text, ""),
  hero_bg_image: plain("content", text, ""),
  hero_slides: plain("content", longText, ""),
  promo_banners: plain("content", longText, ""),
  feature_1_title: plain("content", text, ""),
  feature_1_desc: plain("content", text, ""),
  feature_2_title: plain("content", text, ""),
  feature_2_desc: plain("content", text, ""),
  feature_3_title: plain("content", text, ""),
  feature_3_desc: plain("content", text, ""),
  feature_4_title: plain("content", text, ""),
  feature_4_desc: plain("content", text, ""),
  newsletter_title: plain("content", text, ""),
  newsletter_subtitle: plain("content", text, ""),
  footer_brand_desc: plain("content", text, ""),
  footer_copyright: plain("content", text, ""),

  // ── business rules
  order_number_prefix: plain("business", prefix, BUSINESS_DEFAULTS.orderNumberPrefix),
  pos_order_number_prefix: plain("business", prefix, BUSINESS_DEFAULTS.posOrderNumberPrefix),
  low_stock_threshold: plain("business", count, BUSINESS_DEFAULTS.lowStockThreshold),
  invoice_language: plain("business", z.enum(["bn", "en"]), BUSINESS_DEFAULTS.invoiceLanguage),
  default_product_category: plain("business", text, BUSINESS_DEFAULTS.defaultProductCategory),

  // ── ai: defined here, UI ships with SP-5a or SP-5b (brief §4, SP-1 "ai group").
  ai_provider: plain("ai", z.enum(["", "openai", "anthropic", "google"]), "", adminOnly),
  ai_api_key: secret("ai"),
  ai_model_copilot: plain("ai", text, "", adminOnly),
  ai_model_content: plain("ai", text, "", adminOnly),
  ai_model_chat: plain("ai", text, "", adminOnly),
  // 0 = AI switched off: nothing is spent until the owner sets a budget.
  ai_monthly_budget_usd: plain("ai", amount, 0, adminOnly),
  ai_daily_reply_cap: plain("ai", count, 0, adminOnly),
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTINGS)[K]["schema"]>;
export type GroupValues<G extends SettingGroup> = {
  [K in SettingKey as (typeof SETTINGS)[K]["group"] extends G ? K : never]: SettingValue<K>;
};
/** What a client may send to PATCH /api/settings. */
export type SettingsPatch = { [K in SettingKey]?: z.input<(typeof SETTINGS)[K]["schema"]> };
export type SecretSettingKey = {
  [K in SettingKey]: (typeof SETTINGS)[K]["secret"] extends true ? K : never;
}[SettingKey];

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

export function keysInGroup(group: SettingGroup): SettingKey[] {
  return SETTING_KEYS.filter((key) => SETTINGS[key].group === group);
}

export function groupHasSecrets(group: SettingGroup): boolean {
  return keysInGroup(group).some((key) => SETTINGS[key].secret);
}

/** Typed value → the text stored in site_settings.value. */
export function serializeSetting(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}
