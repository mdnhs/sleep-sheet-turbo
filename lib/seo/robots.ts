import { seoConfig } from "./config"

interface RobotsConfig {
  allowAll?: boolean
  disallowPaths?: string[]
  additionalRules?: string[]
  sitemaps?: string[]
}

export function generateRobotsTxt(config: RobotsConfig = {}): string {
  const {
    allowAll = true,
    disallowPaths = [],
    additionalRules = [],
    sitemaps = [],
  } = config

  const lines: string[] = []

  if (allowAll) {
    lines.push("User-agent: *")
    lines.push("Allow: /")
  }

  for (const path of disallowPaths) {
    lines.push(`Disallow: ${path}`)
  }

  if (additionalRules.length > 0) {
    lines.push("")
    lines.push(...additionalRules)
  }

  const allSitemaps = [
    ...sitemaps,
    `${seoConfig.siteUrl}/sitemap.xml`,
  ]

  for (const sitemap of allSitemaps) {
    lines.push("")
    lines.push(`Sitemap: ${sitemap}`)
  }

  return lines.join("\n")
}

export function defaultRobotsTxt(): string {
  return generateRobotsTxt({
    allowAll: true,
    disallowPaths: [
      "/api/",
      "/dashboard/",
      "/account/",
      "/checkout/",
      "/orders/",
      "/order-success/",
      "/track-order/",
    ],
    // Only AI *training* crawlers are blocked. ChatGPT-User (fetches a page
    // when a ChatGPT user asks about it) is allowed, so ChatGPT can read and
    // link product pages in answers. Google-Extended only governs Gemini
    // training — it has no effect on Google Search or AI Overviews.
    additionalRules: [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: Google-Extended",
      "Disallow: /",
      "",
      "User-agent: CCBot",
      "Disallow: /",
    ],
  })
}
