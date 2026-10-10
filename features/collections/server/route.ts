/* eslint-disable @typescript-eslint/no-unused-vars */
import { Hono } from 'hono'
import { db } from '@/db'
import { products } from '@/db/schema'

const app = new Hono()

.get('/', async (c) => {
  const productsList = await db.query.products.findMany({
    with: {
      reviews: {
        columns: {
          rating: true,
        },
      },
      category: {
        columns: {
          label: true,
          value: true,
        }
      },
    },
  });

  const validProducts = productsList.filter(p => p.tags && p.tags.length > 0);

  const tagCategoryMap: Record<string, Set<string>> = {};
  const tagProductMap: Record<string, { image: string; avgRating: number, category: string }[]> = {};

  for (const product of validProducts) {
    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
        : 0;

    for (const tag of product.tags) {
      const lowercasedTag = tag.toLowerCase();

      if (!tagCategoryMap[lowercasedTag]) {
        tagCategoryMap[lowercasedTag] = new Set();
      }
      tagCategoryMap[lowercasedTag].add(product.categoryId);

      if (!tagProductMap[lowercasedTag]) {
        tagProductMap[lowercasedTag] = [];
      }
      tagProductMap[lowercasedTag].push({
        image: product.images?.[0] || '',
        avgRating,
        category: product.category?.label || '',
      });
    }
  }

  const collections = Object.entries(tagCategoryMap)
    .filter(([_, categories]) => categories.size > 1)
    .map(([tag, _]) => {
      const products = tagProductMap[tag];
      const topProduct = products.sort((a, b) => b.avgRating - a.avgRating)[0];
      return {
        label: tag,
        value: tag.toLowerCase().replace(/\s+/g, '-'),
        image: topProduct?.image || null,
        category: topProduct?.category || '',
      };
    })
    .filter((collection) => collection.image)
    .slice(0, 10);

  // Public storefront content — let the CDN serve repeat visitors so a
  // browsing spike never turns into database queries.
  c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return c.json({ success: true, collections });
});

export default app;
