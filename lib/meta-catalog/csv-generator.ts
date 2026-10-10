import type { CatalogProduct, CatalogVariant } from "./types"
import { escapeCsv } from "./utils"
import { MetaCatalogConfig } from "./config"

const HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "currency",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "google_product_category",
  "product_type",
  "item_group_id",
  "mpn",
  "gtin",
  "color",
  "size",
  "material",
  "gender",
  "age_group",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4",
]

function productToRow(p: CatalogProduct): string[] {
  return [
    p.id,
    p.title,
    p.description,
    p.availability,
    p.condition,
    p.price,
    p.salePrice || "",
    p.currency,
    p.link,
    p.imageLink,
    p.additionalImageLinks.join(", "),
    p.brand,
    p.googleProductCategory,
    p.productType,
    p.itemGroupId,
    p.mpn,
    p.gtin,
    p.color,
    p.size,
    p.material,
    p.gender,
    p.ageGroup,
    p.customLabels[0],
    p.customLabels[1],
    p.customLabels[2],
    p.customLabels[3],
    p.customLabels[4],
  ]
}

function variantToRow(v: CatalogVariant): string[] {
  return [
    v.id,
    v.title,
    v.description,
    v.availability,
    "new",
    v.price,
    v.salePrice || "",
    MetaCatalogConfig.currency,
    v.link,
    v.imageLink,
    v.additionalImageLinks.join(", "),
    v.brand,
    v.googleProductCategory,
    v.productType,
    v.itemGroupId,
    v.mpn,
    v.gtin,
    v.color,
    v.size,
    v.material,
    v.gender,
    v.ageGroup,
    v.customLabels[0],
    v.customLabels[1],
    v.customLabels[2],
    v.customLabels[3],
    v.customLabels[4],
  ]
}

export function generateCsvFeed(
  products: CatalogProduct[],
  variants: CatalogVariant[],
): string {
  const rows: string[] = [HEADERS.map(escapeCsv).join(",")]

  for (const product of products) {
    rows.push(productToRow(product).map(escapeCsv).join(","))
  }

  for (const variant of variants) {
    rows.push(variantToRow(variant).map(escapeCsv).join(","))
  }

  return rows.join("\n") + "\n"
}
