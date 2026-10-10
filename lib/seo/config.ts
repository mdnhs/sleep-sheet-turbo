// Defaults only. Render paths read the store profile instead
// (getStoreProfile / getSiteSeo on the server, useStoreProfile on the
// client); this object keeps its old shape so the remaining callers that
// need only siteUrl, themeColor or defaultImage keep compiling.
import { DEFAULT_SITE_URL, SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

export const seoConfig = {
  siteName: STORE_DEFAULTS.name,
  siteUrl,
  defaultTitle: SEO_DEFAULTS.title,
  defaultDescription: SEO_DEFAULTS.description,
  defaultImage: SEO_DEFAULTS.image,
  defaultLocale: STORE_DEFAULTS.locale,
  themeColor: SEO_DEFAULTS.themeColor,
  organization: {
    name: STORE_DEFAULTS.name,
    url: siteUrl,
    logo: `${siteUrl}${STORE_DEFAULTS.logoUrl}`,
    description: STORE_DEFAULTS.description,
    foundingDate: STORE_DEFAULTS.foundingYear,
    founders: [] as string[],
    sameAs: [STORE_DEFAULTS.social.facebook, STORE_DEFAULTS.social.instagram],
  },
  address: {
    streetAddress: STORE_DEFAULTS.address,
    addressLocality: STORE_DEFAULTS.city,
    addressRegion: STORE_DEFAULTS.city,
    postalCode: STORE_DEFAULTS.postalCode,
    addressCountry: "BD",
  },
  contact: {
    telephone: STORE_DEFAULTS.phone,
    email: STORE_DEFAULTS.email,
    contactType: "customer service",
  },
  socialLinks: {
    facebook: STORE_DEFAULTS.social.facebook,
    instagram: STORE_DEFAULTS.social.instagram,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "",
    bing: process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || "",
  },
};
