import { db } from "@/db"
import { products, specifications, categories } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import type { RawProduct } from "./types"

export async function fetchAllProducts(): Promise<RawProduct[]> {
  try {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        sku: products.sku,
        variants: products.variants,
        sizes: products.sizes,
        tags: products.tags,
        images: products.images,
        features: products.features,
        careInstruction: products.careInstruction,
        categoryId: products.categoryId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        isFeatured: products.isFeatured,
        discount: products.discount,
        defaultVariantName: products.defaultVariantName,
        categoryValue: categories.value,
        categoryLabel: categories.label,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(products.createdAt)

    const productIds = rows.map((r) => r.id)
    const specRows = productIds.length > 0
      ? await db
          .select()
          .from(specifications)
          .where(inArray(specifications.productId, productIds))
      : []

    const specMap = new Map<string, { key: string; value: string }[]>()
    for (const spec of specRows) {
      const list = specMap.get(spec.productId) || []
      list.push({ key: spec.key, value: spec.value })
      specMap.set(spec.productId, list)
    }

    return rows.map((r) => ({
      ...r,
      specifications: specMap.get(r.id) || [],
    }))
  } catch (err) {
    console.warn("[meta-catalog] Database unreachable in fetchAllProducts, returning empty array:", err)
    return []
  }
}
