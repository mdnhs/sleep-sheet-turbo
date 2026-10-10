import Script from "next/script"
import { seoConfig, siteUrl } from "./config"
import type { SiteSeo, StoreProfile } from "@/lib/settings/store-profile"
import type { BreadcrumbItem, ProductSeoData, CategorySeoData, BlogSeoData } from "./types"

export type Publisher = Pick<StoreProfile, "name" | "logoUrl">

export function jsonLd<T>(schema: T): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    ...schema,
  })
}

/** A site-relative path ("/logo.webp") made absolute; absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return `${siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

function postalAddress(store: StoreProfile) {
  return {
    "@type": "PostalAddress",
    streetAddress: store.address,
    addressLocality: store.city,
    addressRegion: store.city,
    ...(store.postalCode ? { postalCode: store.postalCode } : {}),
    addressCountry: store.country,
  }
}

function contactPoint(store: StoreProfile) {
  return { "@type": "ContactPoint", telephone: store.phone, email: store.email, contactType: "customer service" }
}

// Emitted once, from the root layout.
export function organizationSchema(store: StoreProfile) {
  return jsonLd({
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: store.name,
    legalName: store.legalName,
    url: siteUrl,
    // Absolute: Google's logo guidelines for Organization require a full URL.
    logo: absoluteUrl(store.logoUrl),
    description: store.description,
    ...(store.foundingYear ? { foundingDate: store.foundingYear } : {}),
    ...(store.bin ? { vatID: store.bin } : {}),
    sameAs: store.sameAs,
    address: postalAddress(store),
    contactPoint: contactPoint(store),
    // No SearchAction here — it belongs on WebSite (below), not Organization.
  })
}

export function websiteSchema(store: StoreProfile, seo: SiteSeo) {
  return jsonLd({
    "@type": "WebSite",
    name: store.name,
    url: siteUrl,
    description: seo.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/shop?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  })
}

export function webpageSchema(title: string, description: string, url: string, publisher: Publisher) {
  return jsonLd({
    "@type": "WebPage",
    name: title,
    description,
    url,
    publisher: { "@type": "Organization", name: publisher.name, logo: absoluteUrl(publisher.logoUrl) },
    inLanguage: "en",
    dateModified: new Date().toISOString(),
  })
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return jsonLd({
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${seoConfig.siteUrl}${item.url}`,
    })),
  })
}

// Mirrors the published policy on /shipping-returns: a 7-day window, and a
// free replacement for defective, damaged or wrong items (no change-of-mind
// refunds) — keep the two in sync if the policy ever changes.
const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "BD",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 7,
  returnFees: "https://schema.org/FreeReturn",
  refundType: "https://schema.org/ExchangeRefund",
}

// Delivery times from /shipping-returns (inside Dhaka ~1 day, outside 3–4
// days); rates come from the caller so they always match what checkout
// actually bills. "Inside Dhaka" is mapped to Dhaka district (ISO 3166-2
// BD-13); everywhere else in the country falls through to the BD-wide rate.
function shippingDetails(rates: { insideDhaka: number; outsideDhaka: number }) {
  const zone = (rate: number, transit: [number, number], destination: Record<string, string>) => ({
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: rate, currency: "BDT" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD", ...destination },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: transit[0], maxValue: transit[1], unitCode: "DAY" },
    },
  })
  return [
    zone(rates.insideDhaka, [1, 1], { addressRegion: "BD-13" }),
    zone(rates.outsideDhaka, [3, 4], {}),
  ]
}

export function productSchema(product: ProductSeoData) {
  const offers = {
    "@type": "Offer",
    price: product.price,
    priceCurrency: product.currency || "BDT",
    availability: `https://schema.org/${product.availability || "InStock"}`,
    itemCondition: "https://schema.org/NewCondition",
    url: product.url,
    ...(product.sellerName || product.brand
      ? { seller: { "@type": "Organization", name: product.sellerName || product.brand } }
      : {}),
    hasMerchantReturnPolicy: returnPolicy,
    ...(product.shippingRates ? { shippingDetails: shippingDetails(product.shippingRates) } : {}),
    ...(product.compareAtPrice && product.compareAtPrice > product.price
      ? { priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }
      : {}),
  }

  const schema: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${product.url}#product`,
    name: product.name,
    description: product.description,
    url: product.url,
    image: product.images || [seoConfig.defaultImage],
    sku: product.sku || product.id,
    offers,
  }

  if (product.gtin) schema.gtin = product.gtin
  if (product.brand) {
    schema.brand = { "@type": "Brand", name: product.brand }
  }
  if (product.category) {
    schema.category = product.category
  }
  if (product.rating && product.reviewCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }
  // Only reviews actually rendered on the page — Google requires marked-up
  // reviews to be visible to the user.
  if (product.reviews?.length) {
    schema.review = product.reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      datePublished: r.date.split("T")[0],
      reviewBody: r.body,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    }))
  }

  return jsonLd(schema)
}

export function collectionPageSchema(
  name: string,
  description: string,
  url: string,
  products: Array<{ name: string; url: string; image?: string }>,
) {
  return jsonLd({
    "@type": "CollectionPage",
    name,
    description,
    url,
    mainEntity: {
      "@type": "ItemList",
      // Plain ListItems pointing at the product URLs (Google's "summary page"
      // list format). Nesting a "@type": "Product" here made Search Console
      // flag every item as an invalid Product ("offers, review or
      // aggregateRating should be specified") — the full Product markup,
      // with offers and reviews, lives on each product page instead.
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: p.url,
        name: p.name,
      })),
    },
  })
}

export function articleSchema(post: BlogSeoData, publisher: Publisher) {
  const schema: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${post.url}#article`,
    headline: post.title,
    description: post.excerpt,
    url: post.url,
    image: post.coverImage || seoConfig.defaultImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author?.name || publisher.name,
      ...(post.author?.url ? { url: post.author.url } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: publisher.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(publisher.logoUrl),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": post.url,
    },
  }

  if (post.readingTime) {
    schema.timeRequired = `PT${post.readingTime}M`
  }

  if (post.category) {
    schema.articleSection = post.category
  }

  return jsonLd(schema)
}

export function faqSchema(questions: Array<{ question: string; answer: string }>) {
  return jsonLd({
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  })
}

export function localBusinessSchema(store: StoreProfile) {
  return jsonLd({
    "@type": "Store",
    "@id": `${siteUrl}/#store`,
    name: store.name,
    url: siteUrl,
    logo: absoluteUrl(store.logoUrl),
    image: absoluteUrl(seoConfig.defaultImage),
    telephone: store.phone,
    description: store.description,
    address: postalAddress(store),
    contactPoint: contactPoint(store),
    sameAs: store.sameAs,
    // Same hours the contact page publishes (contactHours in
    // hooks/use-language.ts): Saturday–Thursday 9am–9pm, closed Friday. The
    // old list had Monday–Friday open and Sunday missing. Keep this, the
    // contact page and the Google Business Profile in agreement.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "09:00",
        closes: "21:00",
      },
    ],
  })
}

export function imageObjectSchema(url: string, caption: string, width?: number, height?: number) {
  return jsonLd({
    "@type": "ImageObject",
    url,
    caption,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  })
}

export function personSchema(name: string, url?: string, image?: string, jobTitle?: string) {
  return jsonLd({
    "@type": "Person",
    name,
    ...(url ? { url } : {}),
    ...(image ? { image } : {}),
    ...(jobTitle ? { jobTitle } : {}),
  })
}

export function aggregateOfferSchema(
  offers: Array<{ price: number; priceCurrency: string; availability: string }>,
) {
  const lowPrice = Math.min(...offers.map((o) => o.price))
  const highPrice = Math.max(...offers.map((o) => o.price))

  return jsonLd({
    "@type": "AggregateOffer",
    lowPrice,
    highPrice,
    priceCurrency: offers[0]?.priceCurrency || "BDT",
    availability: `https://schema.org/${offers[0]?.availability || "InStock"}`,
    offerCount: offers.length,
    offers: offers.map((o) => ({
      "@type": "Offer",
      price: o.price,
      priceCurrency: o.priceCurrency,
      availability: `https://schema.org/${o.availability}`,
    })),
  })
}

export function videoObjectSchema(
  name: string,
  description: string,
  thumbnailUrl: string,
  contentUrl: string,
  uploadDate: string,
  duration?: string,
) {
  return jsonLd({
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl,
    contentUrl,
    uploadDate,
    ...(duration ? { duration } : {}),
  })
}

export function productGroupSchema(
  groupName: string,
  groupUrl: string,
  groupDescription: string,
  variants: ProductSeoData[],
) {
  return jsonLd({
    "@type": "ProductGroup",
    name: groupName,
    url: groupUrl,
    description: groupDescription,
    variesBy: ["color", "size"],
    hasVariant: variants.map((v) => ({
      "@type": "Product",
      name: v.name,
      url: v.url,
      image: v.images?.[0] || seoConfig.defaultImage,
      sku: v.sku || v.id,
      offers: {
        "@type": "Offer",
        price: v.price,
        priceCurrency: v.currency || "BDT",
        availability: `https://schema.org/${v.availability || "InStock"}`,
      },
    })),
  })
}

export function structuredDataScript(id: string, schema: string) {
  return (
    <script
      key={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: schema }}
    />
  )
}
