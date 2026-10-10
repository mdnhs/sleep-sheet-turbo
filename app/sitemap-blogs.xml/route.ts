import { generateBlogsSitemap } from "@/lib/seo/sitemap"

// Cached for a day: crawlers hit these around the clock, and "force-dynamic"
// meant every one of those hits became a fresh database query.
export const revalidate = 86400

export async function GET() {
  const xml = await generateBlogsSitemap()
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
