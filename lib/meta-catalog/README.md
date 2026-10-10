# Meta Catalog Integration

Automatically synchronized product feed for Meta Commerce Catalog.

## Folder Structure

```
lib/meta-catalog/
  config.ts           -- Central configuration (currency, cache, defaults)
  types.ts            -- All TypeScript interfaces
  utils.ts            -- Price formatting, URL building, escaping, etag
  validators.ts       -- Product validation before feed inclusion
  product-mapper.ts   -- DB product → CatalogProduct/CatalogVariant mapping
  feed-builder.ts     -- Orchestrates feed generation (fetch → map → render → cache)
  xml-generator.ts    -- RSS 2.0 + g: namespace XML feed
  csv-generator.ts    -- Tab-separated CSV feed
  json-generator.ts   -- JSON feed
  cache.ts            -- In-memory feed cache with TTL
  db.ts               -- Drizzle query to fetch all products + specs
  index.ts            -- Barrel exports
```

## Routes

| URL | Format | Content-Type |
|---|---|---|
| `/facebook-feed.xml` | XML | `application/xml` |
| `/facebook-feed.csv` | CSV | `text/csv` |
| `/facebook-feed.json` | JSON | `application/json` |
| `/facebook-feed?format=xml` | XML | `application/xml` |

Internally all three paths rewrite to `/facebook-feed?format=<format>` via `next.config.ts`.

## How Feed Generation Works

1. Request arrives at `/facebook-feed.<format>`
2. Cache is checked — if fresh (`< cacheDuration` seconds), cached content is returned
3. If stale/missing, `fetchAllProducts()` queries all products + categories + specifications
4. Each product is mapped via `mapToCatalogEntries()` → produces `CatalogProduct` + `CatalogVariant[]`
5. Products are validated — invalid entries are skipped and logged
6. Generator renders the feed (XML/CSV/JSON)
7. Feed is cached and returned

## How Product Mapping Works

`product-mapper.ts` handles:

- **ID**: Uses product `id` (cuid) — MUST match `content_ids` in pixel events
- **Title**: Truncated to 150 chars, HTML stripped
- **Description**: Truncated to 5000 chars, HTML stripped
- **Price**: Formatted as `"299.99 BDT"` (configurable currency)
- **Sale price**: Calculated from `discount` percentage field
- **Availability**: `stock >= 1` → `"in stock"`, `stock = 0` → `"out of stock"`
- **Images**: Relative paths are resolved to absolute HTTPS URLs
- **Brand**: Read from `brand` specification key, falls back to config default
- **MPN**: Uses product `sku`
- **GTIN**: Read from `gtin`, `upc`, or `ean` specification keys
- **Google category**: Read from `google_product_category` specification key
- **Color/Size/Material**: Read from variants, sizes array, and `material` spec
- **Gender/Age group**: Read from `gender` and `age_group` spec keys
- **Custom labels**: populated from `isFeatured`, `tags`, `defaultVariantName`, `careInstruction`
- **`item_group_id`**: Always the parent product ID (links variants together)

### Variants

Each combination of variant color × size becomes a separate catalog entry:
- **ID**: `${parentId}-${color}-${size}`
- **`itemGroupId`**: Parent product ID
- **Price**: Variant price (if set) or base price
- **Sale price**: Variant sale price (if discount applies)

## Adding New Fields

1. Add the field to the `CatalogProduct` interface in `types.ts`
2. Add mapping logic in `mapProduct()` in `product-mapper.ts`
3. Add rendering in `xml-generator.ts` (add `xmlTag()` call), `csv-generator.ts` (add to `HEADERS` and `productToRow()`)

Example — adding `weight`:

```typescript
// types.ts
export interface CatalogProduct {
  // ... existing
  weight: string
}

// product-mapper.ts
const data: CatalogProduct = {
  // ... existing
  weight: getSpec(specs, "weight") || "",
}

// xml-generator.ts
lines.push(xmlTag("weight", product.weight))

// csv-generator.ts
HEADERS.push("weight")
productToRow() → push(p.weight)
```

## Adding New Product Types

Products are not typed beyond "new" condition. To support different types:

1. Add a `type` field to `CatalogProduct`
2. Map it in `product-mapper.ts` based on category or specs
3. Render in generators

## How Caching Works

- **In-memory `Map<string, CacheEntry>`**
- TTL: `MetaCatalogConfig.cacheDuration` (default 300 seconds)
- Cache keyed by format (`xml`, `csv`, `json`)
- On cache hit: return cached + `ETag` + `Last-Modified` headers
- On cache miss: rebuild feed
- `invalidateFeed()` clears all cached formats — call this on product create/update/delete

## Multiple Catalog Support

The architecture supports multiple catalogs via configuration:

```typescript
// lib/meta-catalog/config.ts
export const catalogs = {
  default: {
    currency: "BDT",
    country: "BD",
    brandFallback: "Sleep Sheet",
    feedUrl: "/facebook-feed.xml",
    fetchProducts: fetchAllProducts,
  },
  brand_a: {
    currency: "USD",
    country: "US",
    brandFallback: "Brand A",
    feedUrl: "/brand-a-feed.xml",
    fetchProducts: () => fetchProductsByBrand("brand_a"),
  },
}
```

Add routes for each catalog and pass the appropriate `FeedBuilder` instance.

## Pixel Compatibility

The product `id` in the catalog is identical to the `id` in pixel events:

```typescript
// Catalog
{ id: "cm8abc123...", title: "Product Name", ... }

// Pixel event
track("ViewContent", { content_ids: ["cm8abc123..."] })
```

## Conversions API (Future)

Use the same product mapping for server-side events:

```typescript
import { mapProduct } from "@/lib/meta-catalog/product-mapper"

// Get catalog ID for Conversions API
const { data } = mapProduct(rawProduct, categoryLabel)
const catalogId = data?.id  // Same ID used in catalog feed
```

## Validation

Products are validated before inclusion:

- Missing ID → skipped
- Negative/zero price → skipped
- No images → skipped
- Missing SKU → skipped
- Negative stock → skipped

Validation errors are collected and logged but don't block feed generation.

## Performance

- **Memory efficient**: Products are loaded via a single Drizzle query with joins
- **Streaming ready**: `generateXmlFeedStream()` uses `ReadableStream` + `AsyncGenerator` for large catalogs
- **Cached**: In-memory cache with TTL prevents regenerating on every request
- **Batch variant generation**: Variants are generated in-memory after the DB query

## Troubleshooting

### Feed not updating
Call `invalidateFeed()` after product mutations, or wait for cache TTL.

### Invalid feed errors
Check the validation logs — products with missing prices/images/SKUs are excluded.

### Testing with Meta Commerce Manager
1. Go to Commerce Manager → Catalog → Data Sources
2. Add Scheduled Feed or Upload Feed
3. Enter your feed URL: `https://yoursite.com/facebook-feed.xml`
4. Set schedule to Daily
5. Run feed validation

### Product ID mismatch
Ensure `content_ids` in pixel events matches the catalog `id` field exactly (case-sensitive).
