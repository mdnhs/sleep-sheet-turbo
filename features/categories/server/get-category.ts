import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, inArray, count } from "drizzle-orm";

export interface CategoryWithMeta {
  id: string;
  label: string;
  value: string;
  image: string | null;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoContent: string | null;
  productCount: number;
  children: { id: string; label: string; value: string }[];
}

/**
 * Fetch a category by its slug (`value`), including its children and a
 * combined product count (own + children) so category pages and their
 * metadata can be generated server-side.
 */
export async function getCategoryByValue(value: string): Promise<CategoryWithMeta | null> {
  const category = await db.query.categories.findFirst({
    where: eq(categories.value, value),
    with: { children: true },
  });

  if (!category) return null;

  const categoryIds = [category.id, ...category.children.map((c) => c.id)];
  const [{ count: productCount }] = await db
    .select({ count: count() })
    .from(products)
    .where(inArray(products.categoryId, categoryIds));

  return {
    id: category.id,
    label: category.label,
    value: category.value,
    image: category.image,
    parentId: category.parentId,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    seoContent: category.seoContent,
    productCount: Number(productCount),
    children: category.children.map((c) => ({ id: c.id, label: c.label, value: c.value })),
  };
}

/**
 * Small product sample for a category (and its children), used to populate
 * the CollectionPage JSON-LD on category pages.
 */
export async function getCategoryProductsPreview(categoryIds: string[], limit = 12) {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      images: products.images,
    })
    .from(products)
    .where(inArray(products.categoryId, categoryIds))
    .limit(limit);
}
