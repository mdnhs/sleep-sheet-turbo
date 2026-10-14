import { seoConfig } from "./config"
import { cfImageUrl } from "@/lib/media-url"
import type { Metadata } from "next"
import type { SeoMetadata } from "./types"

/** What page metadata needs from the store profile (lib/seo/page-metadata.ts builds it). */
export type SeoStore = { name: string; locale: string; defaultImage: string }

export interface MetadataParams {
  title: string
  description: string
  keywords?: string
  canonical?: string
  robots?: string
  openGraph?: SeoMetadata["openGraph"]
  twitter?: SeoMetadata["twitter"]
  alternates?: SeoMetadata["alternates"]
  noIndex?: boolean
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** "Comforters | Store …" → "Comforters": admin-entered SEO titles sometimes already end in the store name. */
export function stripStoreSuffix(title: string, storeName: string): string {
  const pattern = new RegExp(`\\s*\\|\\s*${escapeRegExp(storeName).replace(/\\? /g, "\\s*")}.*$`, "i")
  return title.replace(pattern, "").trim()
}

export function generateMetadata(
  { title, description, keywords, canonical, robots, openGraph, twitter, alternates, noIndex }: MetadataParams,
  store: SeoStore,
): Metadata {
  const fullTitle = `${title} | ${store.name}`
  const canonicalUrl = canonical || seoConfig.siteUrl
  const rawImage = openGraph?.image || store.defaultImage || "/logo.png"
  const ogImageUrl = rawImage.startsWith("http")
    ? rawImage
    : `${seoConfig.siteUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`

  return {
    // { absolute } opts out of the root layout's `%s | <store>` template:
    // fullTitle already carries the store name once.
    title: { absolute: fullTitle },
    description,
    keywords,
    // "follow" even when noindexed: these pages (empty categories, /sale,
    // account/checkout) still link to real products worth crawling.
    robots: noIndex ? "noindex, follow" : robots || "index, follow, max-image-preview:large, max-snippet:-1",
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical: canonicalUrl,
      ...(alternates?.languages ? { languages: alternates.languages } : {}),
    },
    openGraph: {
      title: openGraph?.title || fullTitle,
      description: openGraph?.description || description,
      url: canonicalUrl,
      siteName: store.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: openGraph?.imageAlt || title }],
      locale: openGraph?.locale || store.locale,
      // Coerce to a type Next's Metadata validator accepts; anything else
      // (e.g. "product") throws "Invalid OpenGraph type" at runtime.
      type: (["website", "article", "book", "profile"].includes(openGraph?.type as string)
        ? openGraph?.type
        : "website") as "website" | "article" | "book" | "profile",
    },
    twitter: {
      card: twitter?.card || "summary_large_image",
      site: twitter?.site,
      creator: twitter?.creator,
      title: twitter?.card ? undefined : fullTitle,
      description: twitter?.card ? undefined : description,
      images: [twitter?.image || ogImageUrl],
    },
    appleWebApp: { capable: true, statusBarStyle: "default", title: store.name },
    applicationName: store.name,
    // No `verification`: the root layout sets it, and a child value would replace it.
  }
}

export function generateProductMetadata(
  product: {
    name: string
    description: string
    slug: string
    images?: string[]
    price?: number
    rating?: number
    reviewCount?: number
  },
  store: SeoStore,
): Metadata {
  return generateMetadata(
    {
      title: product.name,
      description: product.description?.slice(0, 160) || `Shop ${product.name} at ${store.name}`,
      canonical: `${seoConfig.siteUrl}/shop/${product.slug}`,
      openGraph: {
        title: product.name,
        description: product.description?.slice(0, 200),
        // A 900px JPEG, not the stored original: share crawlers don't read
        // AVIF, and WhatsApp drops a preview image over ~300KB, which the
        // detailed fabric photos exceed even at 1080px (≤250KB at this size).
        image: product.images?.[0]
          ? cfImageUrl(product.images[0], "width=900,quality=70,format=jpeg,fit=scale-down")
          : store.defaultImage,
        imageAlt: product.name,
        // Next's Metadata OG `type` union has no "product"; product
        // richness for Meta comes from the catalog feed + Pixel.
        type: "website",
      },
      twitter: { card: "summary_large_image" },
    },
    store,
  )
}

export function generateCategoryMetadata(
  category: { name: string; description?: string; slug: string; page?: number; noIndex?: boolean },
  store: SeoStore,
): Metadata {
  const canonical = `${seoConfig.siteUrl}/categories/${category.slug}${category.page && category.page > 1 ? `?page=${category.page}` : ""}`
  return generateMetadata(
    {
      noIndex: category.noIndex,
      title: category.name + (category.page && category.page > 1 ? ` - Page ${category.page}` : ""),
      description: category.description?.slice(0, 160) || `Browse our collection of ${category.name} at ${store.name}`,
      canonical,
      openGraph: { title: category.name, description: category.description?.slice(0, 200), type: "website" },
    },
    store,
  )
}

export function generateBlogMetadata(
  post: { title: string; excerpt?: string; slug: string; coverImage?: string; author?: { name: string } },
  store: SeoStore,
): Metadata {
  return generateMetadata(
    {
      title: post.title,
      description: post.excerpt?.slice(0, 160) || post.title,
      canonical: `${seoConfig.siteUrl}/blog/${post.slug}`,
      openGraph: {
        title: post.title,
        description: post.excerpt?.slice(0, 200),
        image: post.coverImage || store.defaultImage,
        imageAlt: post.title,
        type: "article",
      },
      twitter: { card: "summary_large_image" },
    },
    store,
  )
}

export function generatePaginatedMetadata(
  baseTitle: string,
  baseDescription: string,
  baseUrl: string,
  page: number,
  totalPages: number,
  store: SeoStore,
): Metadata {
  const isFirst = page <= 1
  const canonical = isFirst ? baseUrl : `${baseUrl}?page=${page}`
  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : undefined
  const nextUrl = page < totalPages ? `${baseUrl}?page=${page + 1}` : undefined

  return {
    ...generateMetadata({ title: isFirst ? baseTitle : `${baseTitle} - Page ${page}`, description: baseDescription, canonical }, store),
    ...(prevUrl ? { alternates: { canonical, ...({ prev: prevUrl } as Record<string, unknown>) } } : {}),
    ...(nextUrl ? { alternates: { canonical, ...({ next: nextUrl } as Record<string, unknown>) } } : {}),
  }
}
