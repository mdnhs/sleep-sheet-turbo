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

// AI *training* crawlers only, switched by the seo_robots_ai_block setting
// (default on). ChatGPT-User (fetches a page when a ChatGPT user asks about
// it) stays allowed; Google-Extended only governs Gemini training.
const AI_TRAINING_RULES = [
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: Google-Extended",
  "Disallow: /",
  "",
  "User-agent: CCBot",
  "Disallow: /",
]

export function defaultRobotsTxt(blockAiTraining = true): string {
  return generateRobotsTxt({
    allowAll: true,
    disallowPaths: ["/api/", "/dashboard/", "/account/", "/checkout/", "/orders/", "/order-success/", "/track-order/"],
    additionalRules: blockAiTraining ? AI_TRAINING_RULES : [],
  })
}
