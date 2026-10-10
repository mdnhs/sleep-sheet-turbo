import { SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

/**
 * The store profile, derived from the public settings map. No zod, no
 * server imports: the storefront reads it on every page from the
 * ["settings"] query the (client) layout already seeds, and the server
 * reads it from the same tag-invalidated getPublicSettings().
 */
type SettingsLike = Readonly<Record<string, string | undefined>> | null | undefined;

export type StoreProfile = {
  name: string;
  nameBn: string;
  legalName: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  addressLink: string;
  city: string;
  postalCode: string;
  country: "BD";
  dbid: string;
  tradeLicence: string;
  bin: string;
  locale: string;
  timezone: string;
  description: string;
  foundingYear: string;
  social: { facebook: string; instagram: string; twitter: string; youtube: string; tiktok: string };
  sameAs: string[];
};

export type SiteSeo = {
  title: string;
  description: string;
  image: string;
  twitterHandle: string;
  googleVerification: string;
  bingVerification: string;
  blockAiTraining: boolean;
};

/** A saved empty value still falls back: a store with no name or phone makes no sense. */
function required(s: SettingsLike, key: string, fallback: string): string {
  return s?.[key]?.trim() || fallback;
}

/** A saved empty value means "none"; only a never-saved one falls back. */
function optional(s: SettingsLike, key: string, fallback: string): string {
  const value = s?.[key];
  return value === undefined ? fallback : value.trim();
}

export function storeProfileFromSettings(s?: SettingsLike): StoreProfile {
  const name = required(s, "site_name", STORE_DEFAULTS.name);
  const social = {
    facebook: optional(s, "social_facebook", STORE_DEFAULTS.social.facebook),
    instagram: optional(s, "social_instagram", STORE_DEFAULTS.social.instagram),
    twitter: optional(s, "social_twitter", STORE_DEFAULTS.social.twitter),
    youtube: optional(s, "social_youtube", STORE_DEFAULTS.social.youtube),
    tiktok: optional(s, "social_tiktok", STORE_DEFAULTS.social.tiktok),
  };
  return {
    name,
    nameBn: required(s, "store_name_bn", STORE_DEFAULTS.nameBn),
    legalName: required(s, "store_legal_name", name),
    logoUrl: required(s, "logo_url", STORE_DEFAULTS.logoUrl),
    phone: required(s, "footer_phone", STORE_DEFAULTS.phone),
    email: required(s, "footer_email", STORE_DEFAULTS.email),
    address: optional(s, "footer_address", STORE_DEFAULTS.address),
    addressLink: optional(s, "footer_address_link", STORE_DEFAULTS.addressLink),
    city: required(s, "store_city", STORE_DEFAULTS.city),
    postalCode: optional(s, "store_postal_code", STORE_DEFAULTS.postalCode),
    country: "BD",
    dbid: optional(s, "store_dbid", STORE_DEFAULTS.dbid),
    tradeLicence: optional(s, "store_trade_licence", STORE_DEFAULTS.tradeLicence),
    bin: optional(s, "store_bin", STORE_DEFAULTS.bin),
    locale: required(s, "store_locale", STORE_DEFAULTS.locale),
    timezone: required(s, "store_timezone", STORE_DEFAULTS.timezone),
    description: required(s, "store_description", STORE_DEFAULTS.description),
    foundingYear: optional(s, "store_founding_year", STORE_DEFAULTS.foundingYear),
    social,
    sameAs: Object.values(social).filter(Boolean),
  };
}

export function siteSeoFromSettings(s?: SettingsLike): SiteSeo {
  return {
    title: required(s, "seo_default_title", SEO_DEFAULTS.title),
    description: required(s, "seo_default_description", SEO_DEFAULTS.description),
    image: required(s, "seo_default_image", SEO_DEFAULTS.image),
    twitterHandle: optional(s, "seo_twitter_handle", ""),
    googleVerification: optional(s, "seo_google_verification", ""),
    bingVerification: optional(s, "seo_bing_verification", ""),
    blockAiTraining: s?.seo_robots_ai_block !== "false",
  };
}

/** Puts the store name into copy written with a {store} placeholder. */
export function fillStore(
  text: string,
  store: Pick<StoreProfile, "name" | "nameBn">,
  language: "bn" | "en" = "en",
): string {
  const name = language === "bn" ? store.nameBn : store.name;
  // A replacer function: a string would have `$&`, `$1` etc. in the name expanded.
  return text.replaceAll("{store}", () => name);
}
