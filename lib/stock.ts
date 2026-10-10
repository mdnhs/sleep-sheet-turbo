import { sql } from "drizzle-orm";
import { invalidateFeed } from "@/lib/meta-catalog/cache";

/**
 * Query for an atomic, oversell-proof stock decrement — call `db.execute()`
 * on the result, or include it as one item in a `db.batch([...])` alongside
 * the order/order_items/payment inserts it must succeed or fail with.
 *
 * Backed by the `decrement_stock_or_fail` DB function (see
 * db/migrations/0014_atomic_stock_decrement.sql). Each item is checked and
 * decremented in the same statement it's read in, so two concurrent sales of
 * the last unit can't both pass a "is there enough stock" check that was run
 * separately from the decrement. If any item doesn't have enough stock, the
 * function raises and the whole enclosing transaction/batch rolls back —
 * nothing is oversold and no order is left orphaned with un-decremented stock.
 *
 * Quantities are summed per product first: the same product can appear on
 * two lines (different size/colour), and the function decrements per
 * productId once.
 */
export function stockDecrementQuery(items: { productId: string; quantity: number }[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }
  const payload = [...totals.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  return sql`select decrement_stock_or_fail(${JSON.stringify(payload)}::jsonb)`;
}

/** The productId that failed stock check, if `error` came from `decrement_stock_or_fail`. */
export function insufficientStockProductId(error: unknown): string | null {
  const message = (error as { message?: string })?.message ?? String(error);
  const match = /INSUFFICIENT_STOCK:(\S+)/.exec(message);
  return match?.[1] ?? null;
}

/**
 * The product ids a decrement took to zero, read off the batch result.
 *
 * `decrement_stock_or_fail` returns them as a jsonb array (see
 * db/migrations/0019_stock_decrement_reports_sold_out.sql). Anything
 * unexpected in the result shape yields an empty list rather than throwing:
 * this runs after the order has already committed, and a parsing problem must
 * not turn a completed sale into a failed request.
 */
export function soldOutProductIds(result: unknown): string[] {
  const rows = (result as { rows?: Array<Record<string, unknown>> })?.rows;
  const value = rows?.[0]?.decrement_stock_or_fail;
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

/**
 * Drop the storefront's cached product data — but only when a sale actually
 * changed what the cache can show.
 *
 * This used to run on every sale. It calls invalidateFeed(), which fires
 * revalidateTag("products") and revalidateTag("categories"), throwing away
 * the cached home, shop, category, product detail and feed pages so the next
 * visitor regenerates all of them. Doing that because a stock count went from
 * 10 to 9 was the single largest source of ISR writes — the deploy's own
 * usage showed more cache writes than cache reads, which defeats the point of
 * caching at all.
 *
 * The storefront never renders the number. It uses `stock > 0` for the
 * in/out-of-stock state and caps the quantity picker at `stock`, and that cap
 * is enforced again server-side by stockDecrementQuery, so a stale cap cannot
 * oversell — the worst it can do is let someone pick a quantity the server
 * then refuses. The only cache-visible change a sale can make is crossing to
 * zero, so that is the only case worth paying for.
 *
 * Product and category edits still invalidate unconditionally: those change
 * names, prices and images, which the cache very much does render.
 */
export function invalidateStockCache(soldOut: string[]) {
  if (soldOut.length === 0) return;
  invalidateFeed();
}
