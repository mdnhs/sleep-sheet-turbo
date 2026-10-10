import { sessionMiddleware } from "@/lib/session-middleware";
import { Hono } from "hono";
import { reviewSchema, updateReviewSchema } from "../schema";
import { db } from "@/db";
import { reviews, products } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { setActivityMeta, type ActivityChange } from "@/features/activity/server/log-activity";
import { invalidateFeed } from "@/lib/meta-catalog/cache";
import { REVIEWS_PAGE_SIZE } from "../constants";

const app = new Hono()
  // Paginated so the product page's "Show more" button can fetch reviews a
  // page at a time instead of everything being embedded (and shipped to
  // every visitor) up front — see features/product/server/get-product.ts,
  // which embeds only the first page and relies on this endpoint for the rest.
  .get("/", async (c) => {
    const productId = c.req.query("productId");
    if (!productId) {
      return c.json({ success: false, error: "productId is required" }, 400);
    }

    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(c.req.query("limit")) || REVIEWS_PAGE_SIZE),
    );
    const offset = (page - 1) * limit;

    try {
      const [rows, [{ total }]] = await Promise.all([
        db.query.reviews.findMany({
          where: eq(reviews.productId, productId),
          with: { user: { columns: { id: true, name: true } } },
          orderBy: [desc(reviews.createdAt)],
          limit,
          offset,
        }),
        db
          .select({ total: count() })
          .from(reviews)
          .where(eq(reviews.productId, productId)),
      ]);

      const data = rows.map((review) => ({
        id: review.id,
        rating: review.rating,
        date: review.createdAt.toISOString(),
        comment: review.comment,
        name: review.user?.name || "Anonymous",
        userId: review.userId,
      }));

      return c.json({
        success: true,
        data,
        total,
        hasNextPage: offset + rows.length < total,
      });
    } catch (error) {
      console.error("Fetch reviews error:", error);
      return c.json({ success: false, error: "Failed to fetch reviews" }, 500);
    }
  })
  .post("/", sessionMiddleware, async (c) => {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json(
          { success: false, error: "User must be logged in to review" }, 
          403
        );
      }

      const body = await c.req.json();
      const validation = reviewSchema.safeParse(body);
      
      if (!validation.success) {
        return c.json(
          { success: false, errors: validation.error.issues },
          400
        );
      }

      const { productId, rating, comment } = validation.data;

      // Only used as an existence check below — the whole product row
      // (description, tags, variants, etc.) was being pulled just to test
      // truthiness (over-fetching flagged in the 2026-09-21 audit).
      const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: { id: true },
      });

      if (!product) {
        return c.json(
          { success: false, error: "Product not found" },
          404
        );
      }

      const [newReview] = await db.insert(reviews).values({
        comment,
        rating,
        userId: user.id,
        productId,
      }).returning();

      const selectedReview = await db.query.reviews.findFirst({
        where: eq(reviews.id, newReview.id),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      // The product detail page's rating/reviewCount come from a 24h
      // unstable_cache keyed on the "products" tag (features/product/server/
      // get-product.ts) — without this, a brand new review wouldn't show up
      // on the product page until that cache naturally expired.
      invalidateFeed();

      return c.json(
        { success: true, data: selectedReview },
        201
      );

    } catch (error) {
      console.error("Review creation error:", error);
      return c.json(
        { success: false, error: "Internal server error" },
        500
      );
    }
  })
.put("/:reviewId", zValidator('json', updateReviewSchema), sessionMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const reviewId = c.req.param("reviewId");
    const { rating, comment } = await c.req.json();
    
    const validation = updateReviewSchema.safeParse({ rating, comment });
    if (!validation.success) {
      return c.json({ 
        success: false, 
        errors: validation.error.issues 
      }, 400);
    }

    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!existingReview) {
      return c.json({ success: false, error: "Review not found" }, 404);
    }

    if (existingReview.userId !== user.id) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const [updatedReview] = await db.update(reviews)
      .set({
        rating: validation.data.rating,
        comment: validation.data.comment,
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    const product = await db.query.products.findFirst({
      where: eq(products.id, existingReview.productId),
      columns: { name: true },
    });
    const changes: ActivityChange[] = [];
    if (existingReview.rating !== updatedReview.rating) {
      changes.push({ label: "Rating", from: existingReview.rating, to: updatedReview.rating });
    }
    if (existingReview.comment !== updatedReview.comment) {
      changes.push({ label: "Comment", from: existingReview.comment, to: updatedReview.comment });
    }
    setActivityMeta(c, { name: product ? `Review on "${product.name}"` : "Review", changes });
    invalidateFeed();

    return c.json({ success: true, data: updatedReview });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
})
  .delete("/:reviewId", sessionMiddleware, async (c) => {
    try {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
  
      const reviewId = c.req.param("reviewId");
  
      const existingReview = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewId),
      });
  
      if (!existingReview) {
        return c.json({ error: "Review not found" }, 404);
      }
  
      if (existingReview.userId !== user.id && user.role !== "ADMIN") {
        return c.json({ error: "Forbidden" }, 403);
      }
  
      await db.delete(reviews).where(eq(reviews.id, reviewId));

      const product = await db.query.products.findFirst({
        where: eq(products.id, existingReview.productId),
        columns: { name: true },
      });
      setActivityMeta(c, { name: product ? `Review on "${product.name}"` : "Review" });
      invalidateFeed();

      return c.json({ success: true });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
  
export default app;