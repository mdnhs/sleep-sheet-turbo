import { seoConfig } from "@/lib/seo/config"

export const MetaCatalogConfig = {
  feedUrl: "/facebook-feed",
  currency: "BDT",
  country: "BD",
  language: "en",
  brandFallback: "Sleep Sheet",
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
