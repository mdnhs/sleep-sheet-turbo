import { NextResponse } from "next/server"
import { FeedBuilder } from "@/lib/meta-catalog/feed-builder"
import { fetchAllProducts } from "@/lib/meta-catalog/db"
import { getCachedFeed } from "@/lib/meta-catalog/cache"

// Regenerated daily. "force-dynamic" plus an unused request argument made this
// route dynamic, so every Merchant/crawler fetch rebuilt the feed from the
// database — the in-memory cache below only ever helped within one instance.
export const revalidate = 86400

const builder = new FeedBuilder(fetchAllProducts)

export async function GET() {
  const cached = getCachedFeed("xml")
  if (cached) {
    return new NextResponse(cached.data, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "ETag": cached.etag,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        "Last-Modified": new Date(cached.generatedAt).toUTCString(),
      },
    })
  }

  try {
    const result = await builder.build("xml")

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "ETag": result.etag,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("Google Merchant feed generation error:", error)
    // Rethrow rather than return a 500: a returned response would be cached
    // as this route's ISR output for a day, while a throw keeps the last good
    // feed in place for Merchant Center / Meta to keep reading.
    throw error
  }
}
