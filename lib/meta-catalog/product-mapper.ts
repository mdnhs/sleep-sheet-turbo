import type { RawProduct, CatalogProduct, CatalogVariant, ValidationError } from "./types"
import { MetaCatalogConfig } from "./config"
import { formatPrice, buildProductLink, buildImageLink, mapAvailability, truncate, stripHtml } from "./utils"
import { validateAndClean } from "./validators"

function getSpec(specs: { key: string; value: string }[], key: string): string | undefined {
  return specs.find((s) => s.key.toLowerCase() === key.toLowerCase())?.value
}

function getGender(specs: { key: string; value: string }[]): "male" | "female" | "unisex" {
  const gender = getSpec(specs, "gender")?.toLowerCase()
  if (gender === "male" || gender === "female") return gender
  return "unisex"
}

function getAgeGroup(specs: { key: string; value: string }[]): "adult" | "kids" | "toddler" | "infant" | "newborn" {
  const age = getSpec(specs, "age_group")?.toLowerCase()
  if (["kids", "toddler", "infant", "newborn"].includes(age || "")) return age as "kids"
  return "adult"
}

function getMaterial(specs: { key: string; value: string }[]): string {
  return getSpec(specs, "material") || ""
}

function getGtin(specs: { key: string; value: string }[]): string {
  return getSpec(specs, "gtin") || getSpec(specs, "upc") || getSpec(specs, "ean") || ""
}

function getGoogleCategory(specs: { key: string; value: string }[]): string {
  return getSpec(specs, "google_product_category") || ""
}

type MapResult = {
  errors: ValidationError[]
  data: CatalogProduct | null
}

export function mapProduct(product: RawProduct, categoryLabel: string): MapResult {
  const { valid, errors } = validateAndClean(product)

  const description = truncate(
    stripHtml(product.description || ""),
    MetaCatalogConfig.descriptionMaxLength,
  )

  const title = truncate(
    stripHtml(product.name || ""),
    MetaCatalogConfig.titleMaxLength,
  )

  const originalPrice = product.discount > 0
    ? product.price / (1 - product.discount / 100)
    : product.price

  const salePrice = product.discount > 0 ? product.price : null

  const priceStr = formatPrice(originalPrice)
  const salePriceStr = salePrice !== null ? formatPrice(salePrice) : null

  const availability = mapAvailability(product.stock)

  // The link is the one field here that's allowed to change out from under
  // an already-running ad — it's re-fetched from this feed on every catalog
  // sync. `id`/`itemGroupId`/`mpn` below stay on product.id/sku: those are
  // Meta's own identity keys for the listing (ad performance history, pixel
  // content_id matching), and must never move once an ad has learned them.
  const link = buildProductLink(product.slug || product.id)

  const mainImage = product.images[0] || ""
  const additionalImages = product.images.slice(1)

  const spec = product.specifications || []

  const data: CatalogProduct = {
    id: product.id,
    title,
    description,
    availability,
    condition: "new",
    price: priceStr,
    salePrice: salePriceStr,
    currency: MetaCatalogConfig.currency,
    link,
    imageLink: buildImageLink(mainImage),
    additionalImageLinks: additionalImages.map(buildImageLink),
    brand: getSpec(spec, "brand") || MetaCatalogConfig.brandFallback,
    googleProductCategory: getGoogleCategory(spec),
    productType: categoryLabel || "",
    itemGroupId: product.id,
    mpn: product.sku || product.id,
    gtin: getGtin(spec),
    color: product.variants.map((v) => v.name).join("/") || "",
    size: product.sizes.join("/") || "",
    material: getMaterial(spec),
    gender: getGender(spec),
    ageGroup: getAgeGroup(spec),
    customLabels: [
      product.isFeatured ? "featured" : "",
      product.tags[0] || "",
      product.tags[1] || "",
      product.defaultVariantName || "",
      product.careInstruction || "",
    ],
  }

  return { errors, data }
}

export function mapVariants(product: RawProduct): CatalogVariant[] {
  const variants: CatalogVariant[] = []
  const mainImage = product.images[0] || ""
  const additionalImages = product.images.slice(1)
  const basePrice = product.price
  const baseAvailability = mapAvailability(product.stock)

  const spec = product.specifications || []
  const brand = getSpec(spec, "brand") || MetaCatalogConfig.brandFallback
  const description = truncate(
    stripHtml(product.description || ""),
    MetaCatalogConfig.descriptionMaxLength,
  )
  const link = buildProductLink(product.slug || product.id)

  const hasOneVariant = product.variants.length <= 1 && product.sizes.length <= 1

  if (hasOneVariant) return variants

  const safeVariants = product.variants.length > 0 ? product.variants : [{ name: "", price: null }]
  const safeSizes = product.sizes.length > 0 ? product.sizes : [""]

  for (let i = 0; i < safeVariants.length; i++) {
    const variant = safeVariants[i]
    for (let j = 0; j < safeSizes.length; j++) {
      const size = safeSizes[j]
      const variantPrice = variant.price ?? basePrice
      const originalPrice = product.discount > 0 
        ? variantPrice / (1 - product.discount / 100) 
        : variantPrice

      const salePrice = product.discount > 0 ? variantPrice : null

      variants.push({
        id: `${product.id}-v${i}-s${j}`,
        itemGroupId: product.id,
        title: `${product.name}${variant.name ? ` - ${variant.name}` : ""}${size ? ` (${size})` : ""}`,
        description,
        price: formatPrice(originalPrice),
        salePrice: salePrice !== null ? formatPrice(salePrice) : null,
        availability: baseAvailability,
        link,
        imageLink: buildImageLink(mainImage),
        additionalImageLinks: additionalImages.map(buildImageLink),
        brand,
        googleProductCategory: getGoogleCategory(spec),
        productType: product.categoryLabel || "",
        mpn: product.sku || product.id,
        gtin: getGtin(spec),
        color: variant.name || "",
        size: size || "",
        material: getMaterial(spec),
        gender: getGender(spec),
        ageGroup: getAgeGroup(spec),
        customLabels: [
          product.isFeatured ? "featured" : "",
          product.tags[0] || "",
          product.tags[1] || "",
          product.defaultVariantName || "",
          product.careInstruction || "",
        ],
      })
    }
  }

  return variants
}

export function mapToCatalogEntries(product: RawProduct, categoryLabel: string): {
  entries: (CatalogProduct | CatalogVariant)[]
  errors: ValidationError[]
} {
  const { data, errors } = mapProduct(product, categoryLabel)
  const variantEntries = mapVariants(product)
  
  const entries: (CatalogProduct | CatalogVariant)[] = []

  if (variantEntries.length > 0) {
    entries.push(...variantEntries)
  } else if (data) {
    entries.push(data)
  }

  return { entries, errors }
}
