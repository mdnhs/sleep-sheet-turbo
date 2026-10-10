import { NextRequest, NextResponse } from "next/server"
import { FeedBuilder } from "@/lib/meta-catalog/feed-builder"
import { fetchAllProducts } from "@/lib/meta-catalog/db"
import { getCachedFeed } from "@/lib/meta-catalog/cache"
import type { FeedFormat } from "@/lib/meta-catalog/types"

export const revalidate = 86400

const builder = new FeedBuilder(fetchAllProducts)

const MIME_TYPES: Record<FeedFormat, string> = {
  xml: "application/xml",
  csv: "text/csv",
  json: "application/json",
}

function getFormat(request: NextRequest): FeedFormat {
  const query = request.nextUrl.searchParams.get("format")
  if (query === "xml" || query === "csv" || query === "json") return query

  const accept = request.headers.get("accept") || ""
  if (accept.includes("xml")) return "xml"
  if (accept.includes("csv")) return "csv"

  return "json"
}

export async function GET(request: NextRequest) {
  const format = getFormat(request)

  const cached = getCachedFeed(format)
  if (cached) {
    return new NextResponse(cached.data, {
      headers: {
        "Content-Type": MIME_TYPES[format],
        "ETag": cached.etag,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        "Last-Modified": new Date(cached.generatedAt).toUTCString(),
      },
    })
  }

  try {
    const result = await builder.build(format)

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": MIME_TYPES[format],
        "ETag": result.etag,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("Feed generation error:", error)
    // Rethrow rather than return a 500: a returned response would be cached
    // as this route's ISR output for a day, while a throw keeps the last good
    // feed in place for Merchant Center / Meta to keep reading.
    throw error
  }
}
