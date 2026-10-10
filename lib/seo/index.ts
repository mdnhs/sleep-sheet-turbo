export { seoConfig, siteUrl } from "./config"
export type { BreadcrumbItem, SeoMetadata, ProductSeoData, CategorySeoData, BlogSeoData } from "./types"
export { generateMetadata, generateProductMetadata, generateCategoryMetadata, generateBlogMetadata, generatePaginatedMetadata } from "./metadata"
export {
  jsonLd,
  organizationSchema,
  websiteSchema,
  webpageSchema,
  breadcrumbSchema,
  productSchema,
  collectionPageSchema,
  articleSchema,
  faqSchema,
  localBusinessSchema,
  sameAsFromSettings,
  imageObjectSchema,
  personSchema,
  aggregateOfferSchema,
  videoObjectSchema,
  productGroupSchema,
  structuredDataScript,
} from "./json-ld"
export { generateRobotsTxt, defaultRobotsTxt } from "./robots"
