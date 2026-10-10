import { unstable_cache } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, posts, products } from "@/db/schema";
import { cacheTag } from "@/lib/cache-tag";

export interface SitemapCategory {
  id: string;
  value: string;
  label: string;
  parentId: string | null;
}

export interface SitemapProduct {
  id: string;
  slug: string | null;
  name: string;
  categoryId: string | null;
}

export interface SitemapPost {
  slug: string;
  title: string;
}

/**
 * Everything the visitor-facing /sitemap page links to, mirroring the XML
 * sitemaps (lib/seo/sitemap.ts): empty categories are left out — they are
 * noindexed thin pages — and so are unpublished posts. One cached read
 * instead of a fresh Neon query per request; the tags are the ones the
 * product/category/blog writes already invalidate.
 */
export const getSitemapPageData = unstable_cache(
  async () => {
    const [allCategories, allProducts, allPosts] = await Promise.all([
      db
        .select({
          id: categories.id,
          value: categories.value,
          label: categories.label,
          parentId: categories.parentId,
        })
        .from(categories)
        .where(
          sql`exists (select 1 from ${products} p where p."productCategory" = ${categories.id})
            or exists (select 1 from ${products} p join ${categories} ch on p."productCategory" = ch.id where ch."parentId" = ${categories.id})`,
        )
        .orderBy(asc(categories.label)),
      db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          hasVideo: sql<boolean>`${products.video} is not null`,
        })
        .from(products)
        .orderBy(asc(products.name)),
      db
        .select({ slug: posts.slug, title: posts.title })
        .from(posts)
        .where(eq(posts.isPublished, true))
        .orderBy(asc(posts.title)),
    ]);
    return {
      categories: allCategories,
      products: allProducts,
      posts: allPosts,
      hasVideos: allProducts.some((p) => p.hasVideo),
    };
  },
  ["sitemap-page-data"],
  { revalidate: 86400, tags: [cacheTag("products"), cacheTag("categories"), cacheTag("blog")] },
);
