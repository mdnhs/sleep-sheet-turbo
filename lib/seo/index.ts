export { seoConfig, siteUrl } from "./config"
export type { BreadcrumbItem, SeoMetadata, ProductSeoData, CategorySeoData, BlogSeoData } from "./types"
export type { SeoStore, MetadataParams } from "./metadata"
export { generateMetadata, generateProductMetadata, generateCategoryMetadata, generateBlogMetadata, generatePaginatedMetadata, stripStoreSuffix } from "./metadata"
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
  absoluteUrl,
  imageObjectSchema,
  personSchema,
  aggregateOfferSchema,
  videoObjectSchema,
  productGroupSchema,
  structuredDataScript,
} from "./json-ld"
export { generateRobotsTxt, defaultRobotsTxt } from "./robots"
