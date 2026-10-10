import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { buildFallback } from "@/lib/build-phase";
import settingsApp from "@/features/settings/server/route";
import type { ProductSummary, ProductVideoItem } from "@/lib/types";
import type { BlogPost } from "@/app/(client)/blog/blog-client";
import type { Testimonial } from "@/features/testimonials/api/use-get-testimonials";
import type { PublicCategory } from "@/features/categories/api/use-get-category";
import type { CategoryListItem } from "@/features/categories/api/use-get-categories";
import { cacheTag } from "@/lib/cache-tag";

// Runs the public settings Hono GET handler in-process (no HTTP round trip)
// so the (client) layout can seed the ["settings"] React Query cache before
// render. That lets the hero — the homepage's LCP element — appear in the
// server HTML with real content instead of a skeleton, without shipping the
// heavier product/category lists (those fetch client-side, off the critical
// path, to keep hydration/Total Blocking Time down).
//
// `fallback` only applies during `next build` (see lib/build-phase.ts). At
// runtime a failed read throws instead, so unstable_cache never stores an
// empty list for a day — callers already .catch() and render without it.
async function fromRoute<T>(
  app: { request: (path: string) => Response | Promise<Response> },
  path: string,
  fallback?: T,
): Promise<T> {
  try {
    const res = await app.request(path);
    if (!res.ok) throw new Error(`Prefetch ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (fallback !== undefined) return buildFallback(err, fallback, `prefetch ${path}`);
    throw err;
  }
}

import categoriesApp from "@/features/categories/server/route";
import productsApp from "@/features/product/server/route";

// Server-side data cache so per-request SSR pages don't hit the database for
// layout settings on every render.
// The revalidate windows below are deliberately long. Each one is a timer that
// wakes the database when it expires, and with steady crawler traffic a short
// window means the compute never gets to suspend. Everything tagged here is
// also invalidated on write (revalidateTag in the settings route and in
// invalidateFeed), so edits still appear immediately — the timer is only the
// fallback for changes that bypass those paths.
//
// Blog and testimonials used to be the exception here, kept at 30 minutes
// because nothing invalidated them on write. Their write routes call
// invalidateBlog()/invalidateTestimonials() now (lib/content-cache.ts), so
// they sit with everything else.
export const getPublicSettings = unstable_cache(
  async () => {
    const data = await fromRoute<Record<string, string>>(settingsApp, "/");
    if (!data || Object.keys(data).length === 0 || (!data.site_name && !data.hero_slides)) {
      throw new Error("Settings not available from DB");
    }
    return data;
  },
  ["prefetch-settings"],
  { revalidate: 86400, tags: [cacheTag("settings")] },
);

export const getPublicCategories = unstable_cache(
  () => fromRoute<{ success: boolean; categories: PublicCategory[] }>(categoriesApp, "/category", { success: true, categories: [] }),
  ["prefetch-categories"],
  { revalidate: 86400, tags: [cacheTag("categories")] }
);

// Flat category list (with parentId), same shape useGetCategories fetches
// client-side for SubcategoryProducts — prefetched so that section can
// render its real carousels in the initial HTML instead of a single-section
// skeleton that pops into N sections once the client query resolves.
export const getPublicCategoryList = unstable_cache(
  () => fromRoute<CategoryListItem[]>(categoriesApp, "/", []),
  ["prefetch-category-list"],
  { revalidate: 86400, tags: [cacheTag("categories")] }
);

import blogApp from "@/features/blog/server/route";
import testimonialsApp from "@/features/testimonials/server/route";

export const getPublicProducts = unstable_cache(
  () => fromRoute<{ data: ProductSummary[] }>(productsApp, "/?sort=newest&limit=8", { data: [] }),
  ["prefetch-products"],
  { revalidate: 86400, tags: [cacheTag("products")] }
);

// First page of a listing grid (category / bestsellers), matching exactly
// what ProductContents' useGetInfiniteProducts asks for on page 1 (same
// default limit, same params), so the server HTML carries real product links
// for crawlers instead of a skeleton, and the client query takes over
// seamlessly once it resolves.
// Products that have a video, for the landing page's video row. Tagged
// "products", so saving a product (or a sale selling it out) refreshes it.
export const getPublicProductVideos = unstable_cache(
  () => fromRoute<{ data: ProductVideoItem[] }>(productsApp, "/videos", { data: [] }),
  ["prefetch-product-videos"],
  { revalidate: 86400, tags: [cacheTag("products")] },
);

// Every product video (up to the API's cap of 100), for the /videos page.
export const getAllPublicProductVideos = unstable_cache(
  () => fromRoute<{ data: ProductVideoItem[] }>(productsApp, "/videos?limit=100", { data: [] }),
  ["prefetch-all-product-videos"],
  { revalidate: 86400, tags: [cacheTag("products")] },
);

export function getPublicProductList(params: { category?: string; sort?: string }) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", "1");
  return unstable_cache(
    () => fromRoute<{ data: ProductSummary[] }>(productsApp, `/?${query.toString()}`, { data: [] }),
    ["prefetch-product-list", params.category ?? "", params.sort ?? ""],
    { revalidate: 86400, tags: [cacheTag("products")] },
  )();
}

export const getPublicBlogPosts = unstable_cache(
  () => fromRoute<{ data: BlogPost[] }>(blogApp, "/", { data: [] }),
  ["prefetch-blog"],
  { revalidate: 86400, tags: [cacheTag("blog")] }
);

export const getPublicTestimonials = unstable_cache(
  async () => {
    const data = await fromRoute<{ data: Testimonial[]; total: number; hasNextPage: boolean; totalPages: number }>(
      testimonialsApp,
      "/?page=1&limit=12",
    );
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error("Testimonials not available from DB");
    }
    return data;
  },
  ["prefetch-testimonials"],
  { revalidate: 86400, tags: [cacheTag("testimonials")] }
);

export type PriceRow = {
  labelKey: "seoPriceComforterSet" | "seoPriceBedSheet";
  min: number;
  max: number;
  href: string;
};

// Price guide rows come from the live catalogue (every product and variant
// price in the category and its sub-categories), so the homepage never
// advertises a range — or a category — the shop doesn't actually carry.
export const getPriceRanges = unstable_cache(
  async (): Promise<PriceRow[]> => {
    try {
      const rows = await db.execute<{ value: string; min: string | null; max: string | null }>(sql`
        SELECT top.value, MIN(pr.price) AS min, MAX(pr.price) AS max
        FROM "Category" top
        JOIN "Category" c ON c.id = top.id OR c."parentId" = top.id
        JOIN products p ON p."productCategory" = c.id
        CROSS JOIN LATERAL (
          SELECT p."productPrice"::numeric AS price
          UNION ALL
          SELECT (v->>'price')::numeric FROM json_array_elements(p."productVariants") v WHERE v->>'price' IS NOT NULL
        ) pr
        WHERE top.value IN ('comforters', 'bedsheet')
        GROUP BY top.value
      `);
      const byValue = new Map(rows.rows.map((r) => [r.value, r]));
      const out: PriceRow[] = [];
      for (const [value, labelKey] of [["comforters", "seoPriceComforterSet"], ["bedsheet", "seoPriceBedSheet"]] as const) {
        const r = byValue.get(value);
        if (r?.min && r?.max) out.push({ labelKey, min: Number(r.min), max: Number(r.max), href: `/categories/${value}` });
      }
      return out;
    } catch (err) {
      return buildFallback(err, [], "getPriceRanges");
    }
  },
  ["home-price-ranges"],
  { revalidate: 86400, tags: [cacheTag("products")] },
);
