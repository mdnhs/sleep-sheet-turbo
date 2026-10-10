import { randomInt } from "crypto";

/**
 * Order numbers are `<PREFIX>-DDMMYY-<suffix>`: human-quotable on a support
 * call, and sortable-ish by eye. The suffix is random rather than a counter
 * because the neon-http driver has no interactive transaction to hold a
 * sequence in, and a per-day counter would need its own row and its own
 * locking to stay gap-free under concurrency.
 *
 * Random means collisions, though, and `orders.orderNumber` is UNIQUE. The
 * suffix used to be 4 base36 characters — 1.68M values per day-prefix, which
 * sounds ample until you apply the birthday bound: two orders on the same day
 * collide with ~50% probability at only ~1,500 orders/day, and ~1% at ~180.
 * There was no retry, so a collision was a 500 and a lost order.
 *
 * Two changes close that. The suffix is now 6 characters from a 32-symbol
 * alphabet (1.07e9 per day, ~0.02% at 1,000 orders/day), and
 * `withOrderNumber` retries on the one constraint that can still collide.
 */

// Crockford-style: no I, L, O or U, so a customer reading a number back over
// the phone can't turn it into a different valid number.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SUFFIX_LENGTH = 6;

/** e.g. generateOrderNumber("ORD") -> "ORD-160925-K3P9XQ". */
export function generateOrderNumber(prefix: string): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);

  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `${prefix}-${dd}${mm}${yy}-${suffix}`;
}

const ORDER_NUMBER_CONSTRAINT = "orders_orderNumber_unique";

/**
 * True only for a unique violation on `orders.orderNumber`.
 *
 * Deliberately narrower than lib/checkout's `isUniqueViolation`: `orders` also
 * has a unique index on `idempotencyKey`, and that conflict means "this order
 * already exists, return it" — retrying with a fresh order number would create
 * the duplicate the key exists to prevent. The neon driver surfaces the
 * constraint name, so the two are distinguishable; the message check is a
 * fallback for drivers or wrappers that don't.
 */
export function isOrderNumberConflict(err: unknown): boolean {
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
    message?: string;
  };
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  if (code !== "23505") return false;
  if (constraint) return constraint === ORDER_NUMBER_CONSTRAINT;
  return (e?.message ?? "").includes(ORDER_NUMBER_CONSTRAINT);
}

/**
 * Run `insert` with a generated order number, retrying with a fresh one if it
 * collides with an existing row.
 *
 * Safe to retry because every caller writes its order inside a single
 * `db.batch`, which Postgres runs as one transaction: a collision rolls back
 * the order, its items, the stock decrement and the payment row together, so
 * the retry starts from a clean slate rather than compounding a partial write.
 *
 * Anything that isn't an order-number collision propagates on the first
 * attempt — callers already distinguish insufficient stock and idempotency-key
 * conflicts, and neither is helped by trying again.
 */
export async function withOrderNumber<T>(
  prefix: string,
  insert: (orderNumber: string) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const orderNumber = generateOrderNumber(prefix);
    try {
      return await insert(orderNumber);
    } catch (error) {
      if (!isOrderNumberConflict(error)) throw error;
      lastError = error;
      console.warn(
        `[order-number] ${orderNumber} collided, retrying (${attempt + 1}/${attempts})`,
      );
    }
  }

  throw lastError;
}
