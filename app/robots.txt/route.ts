import { defaultRobotsTxt } from "@/lib/seo"
import { getSiteSeo } from "@/lib/settings/store"

export async function GET() {
  const { blockAiTraining } = await getSiteSeo()
  return new Response(defaultRobotsTxt(blockAiTraining), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
