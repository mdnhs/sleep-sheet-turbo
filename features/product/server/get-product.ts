import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { eq, desc, count, isNotNull } from "drizzle-orm";
import { Product } from "@/lib/types";
import { REVIEWS_PAGE_SIZE } from "@/features/review/constants";
import { cacheTag } from "@/lib/cache-tag";

// Rating/reviewCount used to be computed by pulling every review (full
// comment text + joined user row) for the product and reducing over the
// whole array in JS — on every cache-populating read, and unbounded as
// review counts grew. This is a single grouped, indexed
// (product_reviews_productId_idx) aggregate query instead: it never scans
// more than "one row per distinct rating value" worth of results.
async function getReviewSummary(productId: string) {
  const rows = await db
    .select({ rating: reviews.rating, count: count() })
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .groupBy(reviews.rating);

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    breakdown[row.rating] = row.count;
    total += row.count;
    sum += row.rating * row.count;
  }

  return {
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    breakdown,
  };
}

// Only the first page of reviews is embedded on the product itself — the
// rest loads through GET /api/reviews (see features/review/server/route.ts)
// as the product page's "Show more" button is clicked. Kept as a function
// (rather than a shared object) so the `with` literal stays inline at each
// call site — that's what lets TypeScript's contextual typing infer
// drizzle's exact relation types instead of widening `category: true` to
// `boolean` and the readonly `orderBy` tuple to a plain array.
function queryProductWithReviews(where: NonNullable<Parameters<typeof db.query.products.findFirst>[0]>["where"]) {
  return db.query.products.findFirst({
    where,
    with: {
      category: true,
      reviews: {
        with: { user: true },
        orderBy: [desc(reviews.createdAt)],
        limit: REVIEWS_PAGE_SIZE,
      },
      specifications: true,
    },
  });
}

/**
 * Fetch and format a single product by id, directly from the database.
 * Shared by the Hono `/api/products/:id` route and the server-rendered
 * product page so both produce the exact same `Product` shape.
 */
async function fetchProductById(id: string): Promise<Product | null> {
  const [raw, summary] = await Promise.all([
    queryProductWithReviews(eq(products.id, id)),
    getReviewSummary(id),
  ]);
  return formatProduct(raw, summary);
}

/**
 * Fetch and format a single product by its public URL slug — what
 * app/(client)/shop/[slug]/page.tsx actually looks up, since the slug (not
 * the id) is the product's URL.
 */
async function fetchProductBySlug(slug: string): Promise<Product | null> {
  // A cheap, indexed lookup just for the id, so the heavier product+reviews
  // query and the review-summary aggregate below can run in parallel instead
  // of the aggregate waiting on the full product fetch to learn the id.
  const idLookup = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    columns: { id: true },
  });
  if (!idLookup) return null;

  const [raw, summary] = await Promise.all([
    queryProductWithReviews(eq(products.slug, slug)),
    getReviewSummary(idLookup.id),
  ]);
  return formatProduct(raw, summary);
}

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof queryProductWithReviews>>>;

type ReviewSummary = Awaited<ReturnType<typeof getReviewSummary>>;

function formatProduct(
  product: ProductWithRelations | undefined,
  summary: ReviewSummary,
): Product | null {
  if (!product) return null;

  const formattedProduct: Product = {
    id: product.id,
    // Defensive fallback only — every row is backfilled/set at creation, but
    // a null here would otherwise silently produce a broken /shop/null link.
    slug: product.slug ?? product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    sku: product.sku,
    tags: product.tags,
    images: product.images,
    video: product.video,
    category: product.category.value,
    categoryLabel: product.category.label,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    specifications: product.specifications.map((s) => ({
      key: s.key,
      value: s.value,
    })),
    care: product.careInstruction || "",
    colors: product.variants,
    // Never leak costPrice through the public product detail response.
    addOns: (product.addOns || []).map(({ name, price }) => ({ name, price })),
    sizes: product.sizes,
    features: product.features,
    isFeatured: product.isFeatured,
    discount: product.discount,
    defaultVariantName: product.defaultVariantName || undefined,
    rating: summary.average,
    reviewCount: summary.total,
    ratingBreakdown: summary.breakdown,
    reviews: product.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      date: review.createdAt.toISOString(),
      comment: review.comment,
      name: review.user?.name || "Anonymous",
      userId: review.userId,
    })),
  };

  return formattedProduct;
}

// The product page hits this twice per render — once in generateMetadata and
// once in the page itself — and the query is a heavy one (product + category +
// every review with its user + specifications). Two layers of cache sit in
// front of it:
//
//   unstable_cache — shared across requests, so repeat visitors and crawlers
//     read one snapshot instead of waking the database compute every time.
//   react cache    — dedupes the two calls inside a single render.
//
// The "products" tag is already revalidated whenever a product is written
// (see lib/meta-catalog/cache.ts), so edits show up immediately rather than
// waiting out the window.
const getCachedProductById = unstable_cache(
  fetchProductById,
  ["product-by-id"],
  { revalidate: 86400, tags: [cacheTag("products")] },
);

export const getProductById = cache(
  (id: string): Promise<Product | null> => getCachedProductById(id),
);

const getCachedProductBySlug = unstable_cache(
  fetchProductBySlug,
  ["product-by-slug"],
  { revalidate: 86400, tags: [cacheTag("products")] },
);

export const getProductBySlug = cache(
  (slug: string): Promise<Product | null> => getCachedProductBySlug(slug),
);

// Every product slug, for the product page's generateStaticParams. Runs once
// per build, so it isn't cached — nothing calls it at request time.
export async function getAllProductSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(isNotNull(products.slug));
  return rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug));
}
