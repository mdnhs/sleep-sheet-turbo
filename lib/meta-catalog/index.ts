export { FeedBuilder } from "./feed-builder"
export { mapProduct, mapVariants, mapToCatalogEntries } from "./product-mapper"
export { generateXmlFeed } from "./xml-generator"
export { generateCsvFeed } from "./csv-generator"
export { generateJsonFeed } from "./json-generator"
export { validateProduct, validateAndClean } from "./validators"
export { getCachedFeed, setCachedFeed, invalidateFeed, getCacheAge } from "./cache"
export { MetaCatalogConfig } from "./config"
export { formatPrice, buildProductLink, buildImageLink, mapAvailability } from "./utils"
export { fetchAllProducts } from "./db"

export type {
  CatalogProduct,
  CatalogVariant,
  FeedFormat,
  ValidationError,
  RawProduct,
  CacheEntry,
  FeedMeta,
} from "./types"
