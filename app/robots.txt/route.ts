import { defaultRobotsTxt } from "@/lib/seo"

export async function GET() {
  const txt = defaultRobotsTxt()
  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
