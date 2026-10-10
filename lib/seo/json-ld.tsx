import Script from "next/script"
import { seoConfig } from "./config"
import type { BreadcrumbItem, ProductSeoData, CategorySeoData, BlogSeoData } from "./types"

export function jsonLd<T>(schema: T): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    ...schema,
  })
}

// Emitted once, from the root layout. `sameAs` should be the social
// profiles that actually exist (from the social_* site settings).
export function organizationSchema(sameAs: string[] = seoConfig.organization.sameAs) {
  return jsonLd({
    "@type": "Organization",
    "@id": `${seoConfig.siteUrl}/#organization`,
    name: seoConfig.organization.name,
    url: seoConfig.organization.url,
    logo: seoConfig.organization.logo,
    description: seoConfig.organization.description,
    foundingDate: seoConfig.organization.foundingDate,
    sameAs,
    address: {
      "@type": "PostalAddress",
      streetAddress: seoConfig.address.streetAddress,
      addressLocality: seoConfig.address.addressLocality,
      addressRegion: seoConfig.address.addressRegion,
      postalCode: seoConfig.address.postalCode,
      addressCountry: seoConfig.address.addressCountry,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: seoConfig.contact.telephone,
      email: seoConfig.contact.email,
      contactType: seoConfig.contact.contactType,
    },
    // No SearchAction here — it belongs on WebSite (below), not Organization.
  })
}

export function websiteSchema() {
  return jsonLd({
    "@type": "WebSite",
    name: seoConfig.siteName,
    url: seoConfig.siteUrl,
    description: seoConfig.defaultDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${seoConfig.siteUrl}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  })
}

export function webpageSchema(title: string, description: string, url: string) {
  return jsonLd({
    "@type": "WebPage",
    name: title,
    description,
    url,
    publisher: {
      "@type": "Organization",
      name: seoConfig.organization.name,
      logo: seoConfig.organization.logo,
    },
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
    seller: { "@type": "Organization", name: seoConfig.siteName },
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

export function articleSchema(post: BlogSeoData) {
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
      name: post.author?.name || seoConfig.organization.name,
      ...(post.author?.url ? { url: post.author.url } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: seoConfig.organization.name,
      logo: {
        "@type": "ImageObject",
        url: seoConfig.organization.logo || `${seoConfig.siteUrl}/logo.png`,
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

export function localBusinessSchema(sameAs: string[] = seoConfig.organization.sameAs) {
  return jsonLd({
    "@type": "Store",
    "@id": `${seoConfig.siteUrl}/#store`,
    name: seoConfig.organization.name,
    url: seoConfig.organization.url,
    logo: seoConfig.organization.logo,
    image: `${seoConfig.siteUrl}${seoConfig.defaultImage}`,
    telephone: seoConfig.contact.telephone,
    description: seoConfig.organization.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: seoConfig.address.streetAddress,
      addressLocality: seoConfig.address.addressLocality,
      addressRegion: seoConfig.address.addressRegion,
      postalCode: seoConfig.address.postalCode,
      addressCountry: seoConfig.address.addressCountry,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: seoConfig.contact.telephone,
      email: seoConfig.contact.email,
      contactType: seoConfig.contact.contactType,
    },
    sameAs,
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

/**
 * Social profiles for `sameAs`, from the social_* site settings — only the
 * accounts that exist. Falls back to the config list if settings are
 * unavailable.
 */
export function sameAsFromSettings(settings: Record<string, string> | null | undefined): string[] {
  if (!settings) return seoConfig.organization.sameAs
  return ["social_facebook", "social_instagram", "social_twitter", "social_youtube", "social_tiktok"]
    .map((key) => settings[key]?.trim())
    .filter((url): url is string => Boolean(url))
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
