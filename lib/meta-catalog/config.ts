import { seoConfig } from "@/lib/seo/config"
import { STORE_DEFAULTS } from "@/lib/settings/defaults"

export const MetaCatalogConfig = {
  feedUrl: "/facebook-feed",
  currency: "BDT",
  country: "BD",
  language: "en",
  brandFallback: STORE_DEFAULTS.name,
  cacheDuration: 300,
  titleMaxLength: 150,
  descriptionMaxLength: 5000,
  linkBase: seoConfig.siteUrl,
  imageBase: seoConfig.siteUrl,
  availabilityInStock: 1,
  availabilityOutOfStock: 0,
  availabilityPreorder: null,
} as const

export function getFeedConfig() {
  return { ...MetaCatalogConfig }
}
