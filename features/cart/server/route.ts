import { sessionMiddleware } from "@/lib/session-middleware";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { carts, cartItems, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { CartResponse } from "../type";

import { calculateItemUnitPrice } from "@/lib/utils";

const addToCartSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
});

const app = new Hono()

  .post("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = addToCartSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      let cart = await db.query.carts.findFirst({
        where: eq(carts.userId, user.id),
        with: { items: true },
      });

      if (!cart) {
        const [newCart] = await db.insert(carts).values({
          userId: user.id,
        }).returning();
        
        cart = {
          ...newCart,
          items: [],
        };
      }

      const existingItem = cart.items.find(item =>
        item.productId === parsed.data.productId &&
        item.size === parsed.data.size &&
        item.color === parsed.data.color
      );

      if (existingItem) {
        await db.update(cartItems)
          .set({ quantity: existingItem.quantity + parsed.data.quantity })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          size: parsed.data.size ?? null,
          color: parsed.data.color ?? null,
        });
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Add to cart error:", error);
      return c.json({ error: "Failed to add to cart" }, 500);
    }
  })

.put("/", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const schema = z.object({
    cartItemId: z.string(),
    quantity: z.number().min(1),
  });

  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.userId, user.id),
      columns: { id: true }
    });

    if (!cart) {
      return c.json({ error: "Cart not found" }, 404);
    }

    const [item] = await db.update(cartItems)
      .set({ quantity: parsed.data.quantity })
      .where(and(
        eq(cartItems.id, parsed.data.cartItemId),
        eq(cartItems.cartId, cart.id)
      ))
      .returning();

    if (!item) {
      return c.json({ error: "Cart item not found" }, 404);
    }

    return c.json({ success: true, item });
  } catch (error) {
    console.error("Update cart error:", error);
    return c.json({ error: "Failed to update cart item" }, 500);
  }
})

  .delete("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const schema = z.object({ cartItemId: z.string() });
    const parsed = schema.safeParse(await c.req.json());
    
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.userId, user.id),
        columns: { id: true }
      });

      if (!cart) {
        return c.json({ error: "Cart not found" }, 404);
      }

      const result = await db.delete(cartItems)
        .where(and(
          eq(cartItems.id, parsed.data.cartItemId),
          eq(cartItems.cartId, cart.id)
        ))
        .returning();

      if (result.length === 0) {
        return c.json({ error: "Cart item not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Delete cart error:", error);
      return c.json({ error: "Failed to remove cart item" }, 500);
    }
  })

  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.userId, user.id),
        with: {
          items: {
            with: { product: true },
            orderBy: (fields, { desc }) => [desc(fields.createdAt)]
          },
        },
      });

      const response: CartResponse = {
        items: cart?.items.map(item => {
          const displayPrice = calculateItemUnitPrice(
            item.color,
            item.product.price,
            item.product.variants as { name: string; price: number | null }[] | null,
            item.product.addOns as { name: string; price: number }[] | null
          );

          return {
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            size: item.size || undefined,
            color: item.color || undefined,
            product: {
              id: item.product.id,
              name: item.product.name,
              price: displayPrice,
              image: item.product.images[0] || "",
              description: item.product.description,
              addOns: item.product.addOns as { name: string; price: number }[] | null,
            }
          };
        }) || []
      };

      return c.json(response);
    } catch (error) {
      console.error("Fetch cart error:", error);
      return c.json({ error: "Failed to fetch cart items" }, 500);
    }
  });

export default app;