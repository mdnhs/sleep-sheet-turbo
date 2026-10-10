import { seoConfig } from "./config"
import { productVideoOgImage, productVideoUrl } from "@/lib/product-video"
import { db } from "@/db"
import { products, posts, categories } from "@/db/schema"
import { count, eq, isNotNull, max, sql } from "drizzle-orm"

// Product names (and admin-entered slugs/image URLs) can contain &, <, >, '
// or " — any of which, unescaped, makes the whole sitemap invalid XML that
// Google rejects outright.
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

interface SitemapEntry {
  url: string
  lastModified?: string
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority?: number
  images?: Array<{ url: string }>
}

function sitemapEntry(entry: SitemapEntry): string {
  const parts = [`  <url>`]
  parts.push(`    <loc>${xmlEscape(entry.url)}</loc>`)
  if (entry.lastModified) {
    parts.push(`    <lastmod>${entry.lastModified}</lastmod>`)
  }
  if (entry.changeFrequency) {
    parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`)
  }
  if (entry.priority !== undefined) {
    parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
  }
  // Only <image:loc> — Google deprecated and ignores image:caption/title.
  if (entry.images?.length) {
    for (const img of entry.images) {
      parts.push(`    <image:image>`)
      parts.push(`      <image:loc>${xmlEscape(img.url)}</image:loc>`)
      parts.push(`    </image:image>`)
    }
  }
  parts.push(`  </url>`)
  return parts.join("\n")
}

function buildSitemapIndex(sitemaps: string[]): string {
  const entries = sitemaps
    .map((s) => `  <sitemap><loc>${seoConfig.siteUrl}${s}</loc></sitemap>`)
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`
}

function buildSitemap(entries: SitemapEntry[], includeImageNs = false): string {
  const xmlns = "http://www.sitemaps.org/schemas/sitemap/0.9"
  const imageNs = includeImageNs ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""
  const body = entries.map(sitemapEntry).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${xmlns}"${imageNs}>\n${body}\n</urlset>`
}

export async function generateMainSitemap() {
  try {
    const [productCount] = await db.select({ count: count() }).from(products)
    const [postCount] = await db.select({ count: count() }).from(posts).where(eq(posts.isPublished, true))
    const [videoCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.video))

    return buildSitemapIndex([
      "/sitemap-pages.xml",
      "/sitemap-products.xml",
      "/sitemap-categories.xml",
      ...(Number(postCount?.count ?? 0) > 0 ? ["/sitemap-blogs.xml"] : []),
      ...(Number(videoCount?.count ?? 0) > 0 ? ["/sitemap-videos.xml"] : []),
      ...(Number(productCount?.count ?? 0) > 0 ? ["/sitemap-images.xml"] : []),
    ])
  } catch (err) {
    console.warn("[sitemap] Failed to generate main sitemap index, returning defaults:", err)
    return buildSitemapIndex([
      "/sitemap-pages.xml",
      "/sitemap-products.xml",
      "/sitemap-categories.xml",
    ])
  }
}

export async function generatePagesSitemap() {
  // lastmod has to be truthful or Google stops trusting it for the whole
  // site — stamping every page "modified now" on each request did exactly
  // that. Listing pages change when a product does, the blog index when a
  // post does; pages with no real signal (about, contact, testimonials)
  // simply omit lastmod rather than guess.
  try {
    const [[latestProduct], [latestPost], [videoStats]] = await Promise.all([
      db.select({ at: max(products.updatedAt) }).from(products),
      db.select({ at: max(posts.updatedAt) }).from(posts).where(eq(posts.isPublished, true)),
      db.select({ count: count(), at: max(products.updatedAt) }).from(products).where(isNotNull(products.video)),
    ])
    const hasVideos = Number(videoStats?.count ?? 0) > 0
    const videosLastModified = videoStats?.at ? new Date(videoStats.at).toISOString() : undefined
    const productsLastModified = latestProduct?.at ? new Date(latestProduct.at).toISOString() : undefined
    const blogLastModified = latestPost?.at ? new Date(latestPost.at).toISOString() : undefined

    // Legal pages carry a real "Last updated" date printed on the page itself
    // (see app/(client)/terms-of-service, /privacy-policy, /shipping-returns) —
    // the sitemap should say the same thing, not always claim "modified today".
    const legalLastModified = new Date("2026-07-17").toISOString()
    // /track-order and /sale are left out on purpose: the first is disallowed
    // in robots.txt and noindexed, the second is noindexed.
    const staticPages: Array<Omit<SitemapEntry, "url"> & { url: string }> = [
      { url: `${seoConfig.siteUrl}`, priority: 1.0, changeFrequency: "weekly", lastModified: productsLastModified },
      { url: `${seoConfig.siteUrl}/shop`, priority: 0.9, changeFrequency: "daily", lastModified: productsLastModified },
      { url: `${seoConfig.siteUrl}/new-arrivals`, priority: 0.8, changeFrequency: "daily", lastModified: productsLastModified },
      { url: `${seoConfig.siteUrl}/bestsellers`, priority: 0.8, changeFrequency: "daily", lastModified: productsLastModified },
      { url: `${seoConfig.siteUrl}/blog`, priority: 0.8, changeFrequency: "weekly", lastModified: blogLastModified },
      // The video page is noindexed while empty, so it only joins the sitemap once a product has a video.
      ...(hasVideos
        ? [{ url: `${seoConfig.siteUrl}/videos`, priority: 0.6, changeFrequency: "weekly" as const, lastModified: videosLastModified }]
        : []),
      { url: `${seoConfig.siteUrl}/testimonials`, priority: 0.6, changeFrequency: "weekly" },
      { url: `${seoConfig.siteUrl}/about`, priority: 0.5, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/contact`, priority: 0.5, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/terms-of-service`, priority: 0.3, changeFrequency: "yearly", lastModified: legalLastModified },
      { url: `${seoConfig.siteUrl}/privacy-policy`, priority: 0.3, changeFrequency: "yearly", lastModified: legalLastModified },
      { url: `${seoConfig.siteUrl}/shipping-returns`, priority: 0.4, changeFrequency: "yearly", lastModified: legalLastModified },
    ]

    return buildSitemap(
      staticPages.map((p) => ({
        url: p.url,
        lastModified: p.lastModified,
        changeFrequency: p.changeFrequency,
        priority: p.priority,
      })),
    )
  } catch (err) {
    console.warn("[sitemap] Failed to generate pages sitemap, returning fallback:", err)
    const staticPages: Array<Omit<SitemapEntry, "url"> & { url: string }> = [
      { url: `${seoConfig.siteUrl}`, priority: 1.0, changeFrequency: "weekly" },
      { url: `${seoConfig.siteUrl}/shop`, priority: 0.9, changeFrequency: "daily" },
      { url: `${seoConfig.siteUrl}/new-arrivals`, priority: 0.8, changeFrequency: "daily" },
      { url: `${seoConfig.siteUrl}/bestsellers`, priority: 0.8, changeFrequency: "daily" },
      { url: `${seoConfig.siteUrl}/blog`, priority: 0.8, changeFrequency: "weekly" },
      { url: `${seoConfig.siteUrl}/testimonials`, priority: 0.6, changeFrequency: "weekly" },
      { url: `${seoConfig.siteUrl}/about`, priority: 0.5, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/contact`, priority: 0.5, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/terms-of-service`, priority: 0.3, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/privacy-policy`, priority: 0.3, changeFrequency: "yearly" },
      { url: `${seoConfig.siteUrl}/shipping-returns`, priority: 0.4, changeFrequency: "yearly" },
    ]
    return buildSitemap(
      staticPages.map((p) => ({
        url: p.url,
        changeFrequency: p.changeFrequency,
        priority: p.priority,
      })),
    )
  }
}

export async function generateProductsSitemap() {
  try {
    const allItems = await db
      .select({ id: products.id, slug: products.slug, name: products.name, updatedAt: products.updatedAt })
      .from(products)

    return buildSitemap(
      allItems.map((p) => ({
        url: `${seoConfig.siteUrl}/shop/${p.slug || p.id}`,
        lastModified: new Date(p.updatedAt).toISOString(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    )
  } catch (err) {
    console.warn("[sitemap] Failed to generate products sitemap, returning empty:", err)
    return buildSitemap([])
  }
}

export async function generateCategoriesSitemap() {
  try {
    const allItems = await db
      .select({ id: categories.id, value: categories.value, updatedAt: categories.updatedAt })
      .from(categories)
      .where(
        sql`exists (select 1 from ${products} p where p."productCategory" = ${categories.id})
          or exists (select 1 from ${products} p join ${categories} ch on p."productCategory" = ch.id where ch."parentId" = ${categories.id})`,
      )

    return buildSitemap(
      allItems.map((c) => ({
        url: `${seoConfig.siteUrl}/categories/${c.value || c.id}`,
        lastModified: new Date(c.updatedAt).toISOString(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    )
  } catch (err) {
    console.warn("[sitemap] Failed to generate categories sitemap, returning empty:", err)
    return buildSitemap([])
  }
}

export async function generateBlogsSitemap() {
  try {
    const allPosts = await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      // Drafts 404 on the public blog — they don't belong in the sitemap.
      .where(eq(posts.isPublished, true))

    return buildSitemap(
      allPosts.map((p) => ({
        url: `${seoConfig.siteUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updatedAt).toISOString(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    )
  } catch (err) {
    console.warn("[sitemap] Failed to generate blogs sitemap, returning empty:", err)
    return buildSitemap([])
  }
}

export async function generateImagesSitemap() {
  try {
    const allItems = await db
      .select({
        id: products.id,
        slug: products.slug,
        images: products.images,
      })
      .from(products)

    const entries: SitemapEntry[] = []
    for (const p of allItems) {
      const productUrl = `${seoConfig.siteUrl}/shop/${p.slug || p.id}`
      const allImages = (p.images || []).filter(Boolean) as string[]
      if (allImages.length > 0) {
        entries.push({
          url: productUrl,
          changeFrequency: "weekly",
          priority: 0.5,
          images: allImages.map((img) => ({ url: img })),
        })
      }
    }

    return buildSitemap(entries, true)
  } catch (err) {
    console.warn("[sitemap] Failed to generate images sitemap, returning empty:", err)
    return buildSitemap([], true)
  }
}

/**
 * Google's video sitemap extension: one <url> per product page that shows a
 * video (it is that page's first gallery slide), with the thumbnail, title,
 * description, file URL and publish date Google asks for. This is what makes
 * the videos eligible for video results.
 */
export async function generateVideosSitemap() {
  try {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        video: products.video,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(isNotNull(products.video))

    const plain = (html: string, max: number) => {
      const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
      return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
    }

    const body = rows
      .flatMap((p) => {
        if (!p.video) return []
        return [
          [
            `  <url>`,
            `    <loc>${xmlEscape(`${seoConfig.siteUrl}/shop/${p.slug || p.id}`)}</loc>`,
            `    <video:video>`,
            `      <video:thumbnail_loc>${xmlEscape(productVideoOgImage(p.video))}</video:thumbnail_loc>`,
            // The spec caps title at 100 characters and description at 2048.
            `      <video:title>${xmlEscape(`${p.name} – video`.slice(0, 100))}</video:title>`,
            `      <video:description>${xmlEscape(plain(p.description, 300) || p.name)}</video:description>`,
            `      <video:content_loc>${xmlEscape(productVideoUrl(p.video))}</video:content_loc>`,
            `      <video:publication_date>${new Date(p.createdAt).toISOString()}</video:publication_date>`,
            `      <video:family_friendly>yes</video:family_friendly>`,
            `    </video:video>`,
            `  </url>`,
          ].join("\n"),
        ]
      })
      .join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${body}\n</urlset>`
  } catch (err) {
    console.warn("[sitemap] Failed to generate videos sitemap, returning empty:", err)
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n</urlset>`
  }
}
