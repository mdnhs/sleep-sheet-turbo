import type { RawProduct, CatalogProduct, CatalogVariant, FeedFormat, ValidationError } from "./types"
import { mapToCatalogEntries } from "./product-mapper"
import { generateXmlFeed } from "./xml-generator"
import { generateCsvFeed } from "./csv-generator"
import { generateJsonFeed } from "./json-generator"
import { getCachedFeed, setCachedFeed, invalidateFeed } from "./cache"

export interface FeedResult {
  content: string
  etag: string
  errors: ValidationError[]
}

export class FeedBuilder {
  private fetchProducts: () => Promise<RawProduct[]>

  constructor(fetchProducts: () => Promise<RawProduct[]>) {
    this.fetchProducts = fetchProducts
  }

  async build(format: FeedFormat): Promise<FeedResult> {
    const cached = getCachedFeed(format)
    if (cached) {
      return { content: cached.data, etag: cached.etag, errors: [] }
    }

    const rawProducts = await this.fetchProducts()

    const allProducts: CatalogProduct[] = []
    const allVariants: CatalogVariant[] = []
    const allErrors: ValidationError[] = []

    for (const raw of rawProducts) {
      const categoryLabel = raw.categoryLabel || raw.categoryValue || ""
      const { entries, errors } = mapToCatalogEntries(raw, categoryLabel)
      allErrors.push(...errors)

      for (const entry of entries) {
        if ("condition" in entry) {
          allProducts.push(entry)
        } else {
          allVariants.push(entry)
        }
      }
    }

    let content: string
    switch (format) {
      case "xml":
        content = generateXmlFeed(allProducts, allVariants, allErrors.map((e) => `${e.productId}: ${e.message}`))
        break
      case "csv":
        content = generateCsvFeed(allProducts, allVariants)
        break
      case "json":
        content = generateJsonFeed(allProducts, allVariants)
        break
    }

    const entry = setCachedFeed(format, content)
    return { content, etag: entry.etag, errors: allErrors }
  }

  invalidate(): void {
    invalidateFeed()
  }
}
