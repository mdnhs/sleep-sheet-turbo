import { db } from "@/db";
import { wishlists } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ParsedWishListData } from "@/lib/types";

const EMPTY_WISHLIST: ParsedWishListData = { wishlistId: "", items: [] };

// Shared by the wishlist route's own GET / and by /api/auth/current, which
// embeds this in its response so the storefront doesn't need a separate
// /api/wishlist round trip on every page load (see features/auth/api/use-current.ts).
export async function getWishlistData(userId: string | undefined): Promise<ParsedWishListData> {
  if (!userId) return EMPTY_WISHLIST;

  const wishlist = await db.query.wishlists.findFirst({
    where: eq(wishlists.userId, userId),
    with: {
      items: {
        with: {
          product: {
            columns: {
              id: true,
              slug: true,
              name: true,
              price: true,
              images: true,
            },
          },
        },
      },
    },
  });

  if (!wishlist) return EMPTY_WISHLIST;

  return {
    wishlistId: wishlist.id,
    items: wishlist.items.map((item) => ({
      id: item.id,
      product: item.product,
    })),
  };
}
