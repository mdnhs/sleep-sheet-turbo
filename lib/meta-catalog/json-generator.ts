import type { CatalogProduct, CatalogVariant } from "./types"

export function generateJsonFeed(
  products: CatalogProduct[],
  variants: CatalogVariant[],
): string {
  const data = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length + variants.length,
    products: products.map((p) => ({
      ...p,
      type: "product" as const,
    })),
    variants: variants.map((v) => ({
      ...v,
      type: "variant" as const,
    })),
  }

  return JSON.stringify(data, null, 2)
}
