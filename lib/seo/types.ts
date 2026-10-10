export interface BreadcrumbItem {
  name: string
  url: string
}

export interface SeoMetadata {
  title: string
  description: string
  keywords?: string
  canonical?: string
  robots?: string
  openGraph?: {
    title?: string
    description?: string
    image?: string
    imageAlt?: string
    type?: "website" | "article" | "product"
    locale?: string
    siteName?: string
  }
  twitter?: {
    card?: "summary" | "summary_large_image" | "app" | "player"
    site?: string
    creator?: string
    image?: string
    imageAlt?: string
  }
  alternates?: {
    canonical?: string
    languages?: Record<string, string>
  }
}

export interface ProductSeoData {
  id: string
  name: string
  description: string
  slug: string
  price: number
  compareAtPrice?: number | null
  currency?: string
  sku?: string
  gtin?: string
  brand?: string
  category?: string
  categorySlug?: string
  images?: string[]
  rating?: number
  reviewCount?: number
  availability?: "InStock" | "OutOfStock" | "PreOrder" | "Discontinued"
  url: string
  /** Delivery charges actually billed at checkout (site settings), in BDT. */
  shippingRates?: { insideDhaka: number; outsideDhaka: number }
  /** Reviews visible on the page (not the full history). */
  reviews?: Array<{ author: string; rating: number; body: string; date: string }>
}

export interface CategorySeoData {
  name: string
  description: string
  slug: string
  url: string
  products: Array<{ name: string; url: string; image?: string }>
  page?: number
  totalPages?: number
}

export interface BlogSeoData {
  id: string
  title: string
  excerpt: string
  slug: string
  content?: string
  author?: { name: string; url?: string }
  coverImage?: string
  publishedAt: string
  updatedAt?: string
  category?: string
  tags?: string[]
  readingTime?: number
  url: string
}
