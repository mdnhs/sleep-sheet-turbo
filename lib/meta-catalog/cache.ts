import type { CacheEntry, FeedFormat } from "./types"
import { MetaCatalogConfig } from "./config"
import { computeEtag } from "./utils"

const store = new Map<string, CacheEntry>()

export function getCachedFeed(format: FeedFormat): CacheEntry | null {
  const key = `feed:${format}`
  const entry = store.get(key)
  if (!entry) return null

  const age = Date.now() - entry.generatedAt
  if (age > MetaCatalogConfig.cacheDuration * 1000) {
    store.delete(key)
    return null
  }

  return entry
}

export function setCachedFeed(format: FeedFormat, data: string): CacheEntry {
  const key = `feed:${format}`
  const entry: CacheEntry = {
    data,
    format,
    generatedAt: Date.now(),
    etag: computeEtag(data),
  }
  store.set(key, entry)
  return entry
}

import { revalidateTag } from "next/cache";

// Called from product/category writes and from every stock decrement, so it
// runs on each sale. It used to also call revalidatePath("/", "layout"), which
// per the Next docs invalidates that layout, every layout under it and every
// page under those — the entire storefront, thrown away on each order, leaving
// the next visitor to re-render every page against the database. The tags below
// already reach the same pages (getPublicProducts/getPublicCategories and the
// product detail cache are all tagged), so the path sweep only added the cost.
//
// { expire: 0 } rather than a named profile: these run inside Hono route
// handlers, and the docs single that case out — a profile like "default" marks
// the entry stale on the profile's own schedule (15 minutes for "default"),
// while expire 0 drops it now, which is what an edit needs.
export function invalidateFeed(): void {
  store.clear();
  try {
    revalidateTag("products", { expire: 0 });
    revalidateTag("categories", { expire: 0 });
  } catch {
    /* Ignore if invoked outside Next.js request lifecycle */
  }
}

export function getCacheAge(format: FeedFormat): number | null {
  const entry = store.get(`feed:${format}`)
  if (!entry) return null
  return Date.now() - entry.generatedAt
}
