import { seoConfig } from "@/lib/seo"

export async function GET() {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/mstile-150x150.png"/>
      <TileColor>${seoConfig.themeColor}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`

  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  })
}
