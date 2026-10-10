import { seoConfig } from "@/lib/seo"
import { getSiteSeo, getStoreProfile } from "@/lib/settings/store"

export async function GET() {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  const manifest = {
    name: store.name,
    short_name: store.name,
    description: seo.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: seoConfig.themeColor,
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
