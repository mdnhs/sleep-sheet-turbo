import { seoConfig } from "./config"
import type { Metadata } from "next"
import type { SeoMetadata } from "./types"

interface MetadataParams {
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

export function generateMetadata({
  title,
  description,
  keywords,
  canonical,
  robots,
  openGraph,
  twitter,
  alternates,
  noIndex,
}: MetadataParams): Metadata {
  const fullTitle = `${title} | ${seoConfig.siteName}`
  const canonicalUrl = canonical || seoConfig.siteUrl
  const rawImage = openGraph?.image || seoConfig.defaultImage || "/logo.png"
  const ogImageUrl = rawImage.startsWith("http")
    ? rawImage
    : `${seoConfig.siteUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`

  return {
    // { absolute } opts out of the root layout's `%s | ${siteName}` title
    // template — fullTitle already has the site name appended, so applying
    // the template on top would double it up ("X | Sleep Sheet | Sleep Sheet").
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
      siteName: seoConfig.siteName,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: openGraph?.imageAlt || title,
        },
      ],
      locale: openGraph?.locale || seoConfig.defaultLocale,
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
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: seoConfig.siteName,
    },
    applicationName: seoConfig.siteName,
    ...(seoConfig.verification.google
      ? { verification: { google: seoConfig.verification.google } }
      : {}),
  }
}

export function generateProductMetadata(product: {
  name: string
  description: string
  slug: string
  images?: string[]
  price?: number
  rating?: number
  reviewCount?: number
}): Metadata {
  return generateMetadata({
    title: product.name,
    description: product.description?.slice(0, 160) || `Shop ${product.name} at ${seoConfig.siteName}`,
    canonical: `${seoConfig.siteUrl}/shop/${product.slug}`,
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 200),
      image: product.images?.[0] || seoConfig.defaultImage,
      imageAlt: product.name,
      // Next's Metadata OG `type` union does not include "product"
      // (valid: website, article, book, profile, music.*, video.*).
      // Product richness for Meta comes from the catalog feed + Pixel
      // content_ids, so "website" is the correct value here.
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  })
}

export function generateCategoryMetadata(category: {
  name: string
  description?: string
  slug: string
  page?: number
  noIndex?: boolean
}): Metadata {
  const canonical = `${seoConfig.siteUrl}/categories/${category.slug}${category.page && category.page > 1 ? `?page=${category.page}` : ""}`
  return generateMetadata({
    noIndex: category.noIndex,
    title: category.name + (category.page && category.page > 1 ? ` - Page ${category.page}` : ""),
    description: category.description?.slice(0, 160) || `Browse our collection of ${category.name} at ${seoConfig.siteName}`,
    canonical,
    openGraph: {
      title: category.name,
      description: category.description?.slice(0, 200),
      type: "website",
    },
  })
}

export function generateBlogMetadata(post: {
  title: string
  excerpt?: string
  slug: string
  coverImage?: string
  author?: { name: string }
}): Metadata {
  return generateMetadata({
    title: post.title,
    description: post.excerpt?.slice(0, 160) || post.title,
    canonical: `${seoConfig.siteUrl}/blog/${post.slug}`,
    openGraph: {
      title: post.title,
      description: post.excerpt?.slice(0, 200),
      image: post.coverImage || seoConfig.defaultImage,
      imageAlt: post.title,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
    },
  })
}

export function generatePaginatedMetadata(
  baseTitle: string,
  baseDescription: string,
  baseUrl: string,
  page: number,
  totalPages: number,
): Metadata {
  const isFirst = page <= 1
  const canonical = isFirst ? baseUrl : `${baseUrl}?page=${page}`
  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : undefined
  const nextUrl = page < totalPages ? `${baseUrl}?page=${page + 1}` : undefined

  return {
    ...generateMetadata({
      title: isFirst ? baseTitle : `${baseTitle} - Page ${page}`,
      description: baseDescription,
      canonical,
    }),
    ...(prevUrl ? { alternates: { canonical, ...({ prev: prevUrl } as Record<string, unknown>) } } : {}),
    ...(nextUrl ? { alternates: { canonical, ...({ next: nextUrl } as Record<string, unknown>) } } : {}),
  }
}
