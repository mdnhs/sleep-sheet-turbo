import { sessionMiddleware } from "@/lib/session-middleware";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { wishlists, wishlistItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getWishlistData } from "./get-wishlist-data";

const WishlistSchema = z.object({
  productId: z.string().min(1),
});

const app = new Hono()
  .post("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { success: false, error: "UnAuthorized" }, 
        403
      );
    }

    const body = await c.req.json();
    const parsed = WishlistSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "invalid Input" }, 400);
    }

    const { productId } = parsed.data;

    try {
      let wishlist = await db.query.wishlists.findFirst({
        where: eq(wishlists.userId, user.id),
      });

      if (!wishlist) {
        const [newWishlist] = await db.insert(wishlists).values({
          userId: user.id,
        }).returning();
        wishlist = newWishlist;
      }

      const existingItem = await db.query.wishlistItems.findFirst({
        where: and(
          eq(wishlistItems.wishlistId, wishlist.id),
          eq(wishlistItems.productId, productId)
        ),
      });

      if (existingItem) {
        return c.json({ success: false, message: "Product already in wishlist" });
      }

      await db.insert(wishlistItems).values({
        wishlistId: wishlist.id,
        productId,
      });

      return c.json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
      console.error("Wishlist add error:", error);
      return c.json({ success: false, error: "Failed to add item to wishlist" }, 500);
    }
  })

  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");

    try {
      const data = await getWishlistData(user?.id);
      return c.json({ success: true, data });
    } catch (error) {
      console.error("Fetch wishlist error:", error);
      return c.json({ success: false, error: "Failed to fetch wishlist" }, 500);
    }
  })
  
  .delete("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "Unauthorized" }, 403);
  
    const body = await c.req.json();
    const parsed = WishlistSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: "Invalid input" }, 400);
  
    const { productId } = parsed.data;
  
    try {
      const wishlist = await db.query.wishlists.findFirst({
        where: eq(wishlists.userId, user.id),
      });
    
      if (!wishlist) {
        return c.json({ success: false, error: "Wishlist not found" }, 404);
      }
    
      await db.delete(wishlistItems)
        .where(and(
          eq(wishlistItems.wishlistId, wishlist.id),
          eq(wishlistItems.productId, productId)
        ));
    
      return c.json({ success: true, message: "Product removed from wishlist" });
    } catch (error) {
      console.error("Remove from wishlist error:", error);
      return c.json({ success: false, error: "Failed to remove item from wishlist" }, 500);
    }
  });
  
export default app;