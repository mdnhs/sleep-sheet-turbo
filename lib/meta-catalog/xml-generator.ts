import type { CatalogProduct, CatalogVariant } from "./types"
import { MetaCatalogConfig } from "./config"
import { escapeXml, formatDate } from "./utils"

function xmlTag(name: string, value: string | null | undefined): string {
  if (!value) return ""
  if (name === "title" || name === "description" || name === "link") {
    return `    <${escapeXml(name)}>${escapeXml(String(value))}</${escapeXml(name)}>\n`
  }
  return `    <g:${escapeXml(name)}>${escapeXml(String(value))}</g:${escapeXml(name)}>\n`
}

function productToXml(product: CatalogProduct): string {
  const lines: string[] = []
  lines.push("  <item>\n")

  const fields: [string, string | null | undefined][] = [
    ["id", product.id],
    ["title", product.title],
    ["description", product.description],
    ["availability", product.availability],
    ["condition", product.condition],
    ["price", product.price],
    ["sale_price", product.salePrice],
    ["link", product.link],
    ["image_link", product.imageLink],
    ["brand", product.brand],
    ["google_product_category", product.googleProductCategory],
    ["product_type", product.productType],
    ["mpn", product.mpn],
    ["gtin", product.gtin],
    ["identifier_exists", product.gtin ? "yes" : "no"],
    ["color", product.color],
    ["size", product.size],
    ["material", product.material],
    ["gender", product.gender],
    ["age_group", product.ageGroup],
    ["custom_label_0", product.customLabels[0]],
    ["custom_label_1", product.customLabels[1]],
    ["custom_label_2", product.customLabels[2]],
    ["custom_label_3", product.customLabels[3]],
    ["custom_label_4", product.customLabels[4]],
  ]

  for (const [name, value] of fields) {
    lines.push(xmlTag(name, value))
  }

  for (const img of product.additionalImageLinks) {
    lines.push(xmlTag("additional_image_link", img))
  }

  lines.push("  </item>\n")
  return lines.join("")
}

function variantToXml(variant: CatalogVariant): string {
  const lines: string[] = []
  lines.push("  <item>\n")

  const fields: [string, string | null | undefined][] = [
    ["id", variant.id],
    ["item_group_id", variant.itemGroupId],
    ["title", variant.title],
    ["description", variant.description],
    ["price", variant.price],
    ["sale_price", variant.salePrice],
    ["availability", variant.availability],
    ["link", variant.link],
    ["image_link", variant.imageLink],
    ["brand", variant.brand],
    ["google_product_category", variant.googleProductCategory],
    ["product_type", variant.productType],
    ["mpn", variant.mpn],
    ["gtin", variant.gtin],
    ["identifier_exists", variant.gtin ? "yes" : "no"],
    ["color", variant.color],
    ["size", variant.size],
    ["material", variant.material],
    ["gender", variant.gender],
    ["age_group", variant.ageGroup],
    ["custom_label_0", variant.customLabels[0]],
    ["custom_label_1", variant.customLabels[1]],
    ["custom_label_2", variant.customLabels[2]],
    ["custom_label_3", variant.customLabels[3]],
    ["custom_label_4", variant.customLabels[4]],
    ["condition", "new"],
  ]

  for (const [name, value] of fields) {
    lines.push(xmlTag(name, value))
  }

  for (const img of variant.additionalImageLinks) {
    lines.push(xmlTag("additional_image_link", img))
  }

  lines.push("  </item>\n")
  return lines.join("")
}

export function generateXmlFeed(
  products: CatalogProduct[],
  variants: CatalogVariant[],
  errors: string[],
): string {
  const now = new Date()
  const parts: string[] = []

  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n')
  parts.push('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n')
  parts.push("  <channel>\n")
  parts.push(`    <title><![CDATA[Product Feed]]></title>\n`)
  parts.push(`    <link>${escapeXml(MetaCatalogConfig.linkBase)}</link>\n`)
  parts.push(`    <description><![CDATA[Meta Catalog Feed]]></description>\n`)
  parts.push(`    <lastBuildDate>${formatDate(now)}</lastBuildDate>\n`)

  for (const product of products) {
    parts.push(productToXml(product))
  }

  for (const variant of variants) {
    parts.push(variantToXml(variant))
  }

  parts.push("  </channel>\n")
  parts.push("</rss>\n")

  return parts.join("")
}

export function generateXmlFeedStream(
  products: AsyncGenerator<CatalogProduct[], void, unknown>,
  variants: AsyncGenerator<CatalogVariant[], void, unknown>,
): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const now = new Date()
      controller.enqueue(encoder.encode('<?xml version="1.0" encoding="UTF-8"?>\n'))
      controller.enqueue(encoder.encode('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n'))
      controller.enqueue(encoder.encode("  <channel>\n"))
      controller.enqueue(encoder.encode(`    <title><![CDATA[Product Feed]]></title>\n`))
      controller.enqueue(encoder.encode(`    <link>${escapeXml(MetaCatalogConfig.linkBase)}</link>\n`))
      controller.enqueue(encoder.encode(`    <description><![CDATA[Meta Catalog Feed]]></description>\n`))
      controller.enqueue(encoder.encode(`    <lastBuildDate>${formatDate(now)}</lastBuildDate>\n`))

      for await (const batch of products) {
        for (const product of batch) {
          controller.enqueue(encoder.encode(productToXml(product)))
        }
      }

      for await (const batch of variants) {
        for (const variant of batch) {
          controller.enqueue(encoder.encode(variantToXml(variant)))
        }
      }

      controller.enqueue(encoder.encode("  </channel>\n"))
      controller.enqueue(encoder.encode("</rss>\n"))
      controller.close()
    },
  })
}
