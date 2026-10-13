import { Hono } from 'hono';
import { db } from '@/db';
import { products, categories, reviews, specifications, users, orderItems, orders, productVideoLikes, productVideoStats } from '@/db/schema';
import { eq, and, or, lte, gte, gt, isNotNull, ilike, sql, desc, asc, inArray, ne, type SQL } from 'drizzle-orm';
import { Product } from '@/lib/types';
import { getProductById } from './get-product';
import { sessionMiddleware } from '@/lib/session-middleware';
import { can, isAllowed } from '@/lib/permissions';
import { getImageIdentity } from '@/lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

// Total units sold per product, from real (non-cancelled) orders — used to
// rank the bestselling sort. Products with zero sales don't appear here at
// all (no matching orderItems rows), so callers must COALESCE to 0.
const salesSubquery = db
  .select({
    productId: orderItems.productId,
    totalSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`.as("totalSold"),
  })
  .from(orderItems)
  .innerJoin(orders, eq(orderItems.orderId, orders.id))
  .where(ne(orders.status, "CANCELLED"))
  .groupBy(orderItems.productId)
  .as("sales");

// Per-product average rating + review count. The list endpoint used to
// return neither, so every ProductCard silently fell back to a fake "4.4" —
// real reviews existed in the DB but never reached the storefront grid,
// only the single-product page (features/product/server/get-product.ts,
// which reads the reviews relation directly).
const ratingsSubquery = db
  .select({
    productId: reviews.productId,
    avgRating: sql<number>`AVG(${reviews.rating})`.as("avgRating"),
    reviewCount: sql<number>`COUNT(*)`.as("reviewCount"),
  })
  .from(reviews)
  .groupBy(reviews.productId)
  .as("ratings");

// Product descriptions are rich-text HTML; structured data wants plain text.
function plainSnippet(html: string, max: number): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const app = new Hono()

// Registered ahead of "/:id" — Cloudinary-image duplicate report for the
// admin products page's Duplicates view. Dashboard-only (unlike the public
// listing below), so it's gated on real products:read access rather than
// bypassable by an "admin" query flag.
.get("/duplicates", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "products", "read", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const category = c.req.query("category");
  const search = c.req.query("search");

  const filterConditions: SQL[] = [];

  if (category) {
    const categoryList = category.split(",").map(c => c.trim()).filter(Boolean);
    if (categoryList.length > 0) {
      const matchedCategories = await db.query.categories.findMany({
        where: inArray(categories.label, categoryList)
      });

      const matchedIds = matchedCategories.map(c => c.id);
      let allValidLabels = [...categoryList];

      if (matchedIds.length > 0) {
        const childCategories = await db.query.categories.findMany({
          where: inArray(categories.parentId, matchedIds)
        });
        allValidLabels = [...new Set([...categoryList, ...childCategories.map(c => c.label)])];
      }

      filterConditions.push(
        allValidLabels.length === 1
          ? eq(categories.label, allValidLabels[0])
          : inArray(categories.label, allValidLabels)
      );
    }
  }

  if (search) {
    filterConditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(categories.label, `%${search}%`)
      )!
    );
  }

  try {
    const query = db.select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      stock: products.stock,
      images: products.images,
      isFeatured: products.isFeatured,
      categoryId: products.categoryId,
      categoryLabel: categories.label,
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    if (filterConditions.length > 0) {
      query.where(and(...filterConditions));
    }

    const rows = await query;

    type DuplicateProduct = {
      id: string;
      slug: string;
      name: string;
      price: number;
      stock: number;
      images: string[];
      isFeatured: boolean;
    };
    type DuplicateGroup = {
      image: string;
      categoryLabel: string;
      products: Map<string, DuplicateProduct>;
    };

    // Same image reused within one product's own gallery isn't a duplicate —
    // only when 2+ distinct products in the same category share it.
    const groups = new Map<string, DuplicateGroup>();

    for (const row of rows) {
      const seenInThisProduct = new Set<string>();
      for (const image of row.images) {
        const publicId = getImageIdentity(image);
        if (!publicId || seenInThisProduct.has(publicId)) continue;
        seenInThisProduct.add(publicId);

        const key = `${row.categoryId}::${publicId}`;
        let group = groups.get(key);
        if (!group) {
          group = { image, categoryLabel: row.categoryLabel || "Uncategorized", products: new Map() };
          groups.set(key, group);
        }
        group.products.set(row.id, {
          id: row.id,
          slug: row.slug ?? row.id,
          name: row.name,
          price: row.price,
          stock: row.stock,
          images: row.images,
          isFeatured: row.isFeatured,
        });
      }
    }

    const duplicateGroups = Array.from(groups.values())
      .filter((group) => group.products.size > 1)
      .map((group) => ({
        image: group.image,
        categoryLabel: group.categoryLabel,
        products: Array.from(group.products.values()),
      }))
      .sort((a, b) => b.products.length - a.products.length);

    return c.json({ data: duplicateGroups });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch duplicate products" }, 500);
  }
})

// Landing-page video row: only products that have a video and are in stock,
// newest first. Public and CDN-cached like the other storefront reads, and
// registered ahead of "/:id" so "videos" isn't taken for a product id.
.get("/videos", async (c) => {
  // The landing-page row asks for the default 12; the /videos page asks for all.
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 12, 1), 100);
  try {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        price: products.price,
        discount: products.discount,
        variants: products.variants,
        defaultVariantName: products.defaultVariantName,
        description: products.description,
        createdAt: products.createdAt,
        video: products.video,
        likes: sql<number>`${products.videoLikesBase} + (select count(*)::int from ${productVideoLikes} where ${productVideoLikes.productId} = ${products.id})`,
      })
      .from(products)
      .where(and(isNotNull(products.video), gt(products.stock, 0)))
      .orderBy(desc(products.createdAt), asc(products.id))
      .limit(limit);

    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return c.json({
      data: rows.flatMap((row) =>
        row.video
          ? [{
              id: row.id,
              slug: row.slug ?? row.id,
              name: row.name,
              price: row.price,
              discount: row.discount,
              defaultVariantName: row.defaultVariantName || undefined,
              colors: row.variants,
              video: row.video,
              // Plain-text blurb and publish date: the /videos page uses them
              // for VideoObject structured data.
              description: plainSnippet(row.description, 200),
              uploadDate: row.createdAt.toISOString(),
              // A snapshot — it is cached with the list. The Reels viewer
              // refreshes it from /videos/likes when it opens.
              likes: Number(row.likes) || 0,
            }]
          : [],
      ),
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch product videos" }, 500);
  }
})

// Fresh like counts for every video, as { [productId]: count }. Kept apart from
// the cached list above so a like shows up without invalidating product caches.
.get("/videos/likes", async (c) => {
  try {
    const rows = await db
      .select({
        productId: products.id,
        likes: sql<number>`${products.videoLikesBase} + (select count(*)::int from ${productVideoLikes} where ${productVideoLikes.productId} = ${products.id})`,
      })
      .from(products)
      .where(isNotNull(products.video));
    c.header("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    return c.json({ data: Object.fromEntries(rows.map((r) => [r.productId, Number(r.likes)])) });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch likes" }, 500);
  }
})

// Like / unlike a video — open to guests. The visitor id is a random id the
// browser keeps; the (product, visitor) primary key makes liking twice a
// no-op, and the per-IP rate limit stops one person from stuffing the counts
// by minting visitor ids.
.post(
  "/videos/:id/like",
  rateLimit("video-like", 60, 10 * 60_000),
  zValidator("json", z.object({
    visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    liked: z.boolean(),
  })),
  async (c) => {
    const id = c.req.param("id");
    const { visitorId, liked } = c.req.valid("json");
    try {
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, id), isNotNull(products.video)),
        columns: { id: true },
      });
      if (!product) return c.json({ error: "Video not found" }, 404);

      if (liked) {
        await db.insert(productVideoLikes).values({ productId: id, visitorId }).onConflictDoNothing();
      } else {
        await db
          .delete(productVideoLikes)
          .where(and(eq(productVideoLikes.productId, id), eq(productVideoLikes.visitorId, visitorId)));
      }
      const [row] = await db
        .select({
          likes: sql<number>`${products.videoLikesBase} + (select count(*)::int from ${productVideoLikes} where ${productVideoLikes.productId} = ${products.id})`,
        })
        .from(products)
        .where(eq(products.id, id));
      return c.json({ likes: Number(row?.likes ?? 0), liked });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to save like" }, 500);
    }
  },
)

// Reels analytics. The viewer reports one batch per watched video (a view,
// the seconds watched, and whether Order Now / Share was tapped), usually via
// sendBeacon as the visitor swipes on or closes. Each field is capped so a
// single request can't skew the totals, and the per-IP rate limit bounds the
// rest. Upsert keeps it to one row per product.
.post(
  "/videos/:id/stats",
  rateLimit("video-stats", 240, 10 * 60_000),
  zValidator("json", z.object({
    views: z.number().int().min(0).max(1).default(0),
    watchSeconds: z.number().int().min(0).max(600).default(0),
    orderClicks: z.number().int().min(0).max(1).default(0),
    shares: z.number().int().min(0).max(1).default(0),
  })),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    if (!body.views && !body.watchSeconds && !body.orderClicks && !body.shares) {
      return c.body(null, 204);
    }
    try {
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, id), isNotNull(products.video)),
        columns: { id: true },
      });
      if (!product) return c.json({ error: "Video not found" }, 404);

      await db
        .insert(productVideoStats)
        .values({ productId: id, ...body })
        .onConflictDoUpdate({
          target: productVideoStats.productId,
          set: {
            views: sql`${productVideoStats.views} + ${body.views}`,
            watchSeconds: sql`${productVideoStats.watchSeconds} + ${body.watchSeconds}`,
            orderClicks: sql`${productVideoStats.orderClicks} + ${body.orderClicks}`,
            shares: sql`${productVideoStats.shares} + ${body.shares}`,
            updatedAt: new Date(),
          },
        });
      return c.body(null, 204);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to save stats" }, 500);
    }
  },
)

// Per-video totals for the dashboard, as { [productId]: stats }.
.get("/videos/stats", sessionMiddleware, async (c) => {
  if (!isAllowed(c.get("user"), "products", "read", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  try {
    const rows = await db.select().from(productVideoStats);
    c.header("Cache-Control", "private, no-store");
    return c.json({
      data: Object.fromEntries(
        rows.map(({ productId, views, watchSeconds, orderClicks, shares }) => [
          productId,
          { views, watchSeconds, orderClicks, shares },
        ]),
      ),
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch video stats" }, 500);
  }
})

.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const formattedProduct = await getProductById(id);

    if (!formattedProduct) {
      return c.json({ error: "Product Not Found" }, 404);
    }

    c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return c.json({ formattedProduct }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
})

.get("/", sessionMiddleware, async (c) => {
  const category = c.req.query("category");
  const sort = c.req.query("sort") || "newest";
  const minPrice = c.req.query("minPrice");
  const maxPrice = c.req.query("maxPrice");
  const search = c.req.query("search");
  // `?admin=true` used to be trusted on its own — an unauthenticated caller
  // could send it to force the uncached branch below on every request,
  // bypassing the CDN entirely and sending every request straight to
  // Postgres (BAD-13, audit 2026-09-21). This endpoint has no other auth
  // requirement (it's the public storefront listing), so sessionMiddleware
  // is added here only to make this one flag require real dashboard access;
  // an anonymous or unauthorized caller always gets the cached, public-sort
  // response regardless of what it sends.
  const requestedAdmin = c.req.query("admin") === "true";
  const admin = requestedAdmin && isAllowed(c.get("user"), "products", "read", ["MODERATOR"]) ? "true" : "false";
  // The CDN cache below is meant for the anonymous public storefront listing.
  // POS needs to see stock/price/discount edits the instant they happen —
  // a stale s-maxage=60/stale-while-revalidate=300 response was letting
  // cashiers sell against numbers that were up to several minutes old. This
  // only skips the cache header; it doesn't touch `admin`, so POS keeps the
  // default featured-first ordering instead of the admin dashboard's plain sort.
  const posBypassCache = c.req.query("pos") === "true" && can(c.get("user"), "pos", "write");
  const limit = Math.min(parseInt(c.req.query("limit") || "8", 10) || 8, 100);
  // `limit` was already clamped; `page` was not, so `?page=0` produced a
  // negative OFFSET and `?page=abc` a NaN one — both rejected by Postgres,
  // both surfacing as a 500 on a public endpoint.
  const parsedPage = parseInt(c.req.query("page") || "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

  const filterConditions: SQL[] = [];

  if (category) {
    const categoryList = category.split(",").map(c => c.trim()).filter(Boolean);
    if (categoryList.length > 0) {
      const matchedCategories = await db.query.categories.findMany({
        where: inArray(categories.label, categoryList)
      });
      
      const matchedIds = matchedCategories.map(c => c.id);
      
      let allValidLabels = [...categoryList];
      
      if (matchedIds.length > 0) {
        const childCategories = await db.query.categories.findMany({
          where: inArray(categories.parentId, matchedIds)
        });
        
        allValidLabels = [...new Set([...categoryList, ...childCategories.map(c => c.label)])];
      }

      if (allValidLabels.length === 1) {
        filterConditions.push(eq(categories.label, allValidLabels[0]));
      } else {
        filterConditions.push(inArray(categories.label, allValidLabels));
      }
    }
  }

  if (minPrice) {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) {
      filterConditions.push(gte(products.price, min));
    }
  }

  if (maxPrice) {
    const max = parseFloat(maxPrice);
    if (!isNaN(max)) {
      filterConditions.push(lte(products.price, max));
    }
  }

  const featured = c.req.query("featured");

  if (featured === "true") {
    filterConditions.push(eq(products.isFeatured, true));
  } else if (featured === "false") {
    filterConditions.push(eq(products.isFeatured, false));
  }

  // Note: We don't filter by isFeatured when sort="featured" because it's a sort option, 
  // not a filter. It will sort featured products first via orderConditions.

  if (search) {
    // `description` used to be searched too, but it's the full TipTap HTML
    // body (several KB per row) — matching it needed a sequential scan
    // regardless of any index on `name`, since nothing indexes markup body
    // text here. Dropped in favor of the products_name_trgm_idx GIN index
    // (see db/migrations/0022), which serves name/category search without
    // a table scan; description was rarely what a shopper actually searched
    // by (BAD-12, audit 2026-09-21).
    filterConditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(categories.label, `%${search}%`)
      )!
    );
  }

  const orderConditions: SQL[] = admin === "true" ? [] : [desc(products.isFeatured)];
  switch (sort) {
    case "newest":
      orderConditions.push(desc(products.createdAt));
      break;
    case "oldest":
      orderConditions.push(asc(products.createdAt));
      break;
    case "name-asc":
      orderConditions.push(asc(products.name));
      break;
    case "name-desc":
      orderConditions.push(desc(products.name));
      break;
    case "stock-asc":
      orderConditions.push(asc(products.stock));
      break;
    case "stock-desc":
      orderConditions.push(desc(products.stock));
      break;
    case "price-asc":
      orderConditions.push(asc(products.price));
      break;
    case "price-desc":
      orderConditions.push(desc(products.price));
      break;
    case "featured":
      orderConditions.push(desc(products.updatedAt));
      break;
    case "bestselling":
      orderConditions.push(desc(sql`COALESCE(${salesSubquery.totalSold}, 0)`));
      break;
  }

  try {
    const countQuery = db.select({
      count: sql<number>`count(*)`
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id));

    if (filterConditions.length > 0) {
      countQuery.where(and(...filterConditions));
    }

    const [countResult] = await countQuery;
    const totalCount = Number(countResult?.count || 0);

    const mainQuery = db.select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      price: products.price,
      stock: products.stock,
      sku: products.sku,
      variants: products.variants,
      addOns: products.addOns,
      sizes: products.sizes,
      tags: products.tags,
      images: products.images,
      video: products.video,
      careInstruction: products.careInstruction,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      isFeatured: products.isFeatured,
      discount: products.discount,
      defaultVariantName: products.defaultVariantName,
      categoryValue: categories.value,
      categoryLabel: categories.label,
      avgRating: ratingsSubquery.avgRating,
      reviewCount: ratingsSubquery.reviewCount,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    // Only `sort=bestselling` reads a column from this aggregate. Postgres
    // removes the join outright for every other sort — the subquery is unique
    // on productId and nothing references its output, so the planner elides
    // it (verified with EXPLAIN: identical plan and cost either way). Leaving
    // it unconditional keeps the builder in one piece at no runtime cost.
    .leftJoin(salesSubquery, eq(products.id, salesSubquery.productId))
    .leftJoin(ratingsSubquery, eq(products.id, ratingsSubquery.productId));

    if (filterConditions.length > 0) {
      mainQuery.where(and(...filterConditions));
    }

    // A unique tiebreaker is required so ties on the primary sort column
    // (e.g. many products sharing the same updatedAt after a bulk import)
    // get a stable order across separate OFFSET/LIMIT page queries — without
    // it, Postgres can return the same row on two different pages (or skip
    // one entirely), which showed up as a duplicate React key in infinite
    // scroll. Same fix already used for orders (features/order/server/route.ts).
    mainQuery.orderBy(...orderConditions, asc(products.id));

    mainQuery.limit(limit).offset((page - 1) * limit);

    const productsList = await mainQuery;

    // Cache public storefront listings at the CDN; the admin dashboard and
    // POS need to see edits immediately, so those variants stay uncached.
    if (admin !== "true" && !posBypassCache) {
      c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }

    return c.json({
      data: productsList.map(product => ({
        id: product.id,
        // Defensive fallback only — see get-product.ts's identical comment.
        slug: product.slug ?? product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        sku: product.sku,
        tags: product.tags,
        images: product.images,
        video: product.video,
        colors: product.variants,
        // Never leak costPrice through the public product feed — strip it
        // even though the DB column now carries it for admin cost tracking.
        addOns: (product.addOns || []).map(({ name, price }) => ({ name, price })),
        sizes: product.sizes,
        category: product.categoryValue || "",
        categoryLabel: product.categoryLabel || "",
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        isFeatured: product.isFeatured,
        discount: product.discount,
        defaultVariantName: product.defaultVariantName || undefined,
        rating: product.avgRating ? Number(Number(product.avgRating).toFixed(1)) : 0,
        reviewCount: Number(product.reviewCount || 0),
      })),
      total: totalCount,
      hasNextPage: page * limit < totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
    
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch products" }, 500);
  }
});

export default app;
