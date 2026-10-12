// Promotion rules shared by the checkout server (the authority on what the
// customer pays) and the checkout UI (which shows the same result before the
// order is placed). Pure, so both sides agree and it is cheap to test.

export const PROMOTION_PAYMENT_METHODS = ["cod", "bkash", "card"] as const;
export type PromotionPaymentMethod = (typeof PROMOTION_PAYMENT_METHODS)[number];

export const PROMOTION_ZONES = ["inside_dhaka", "outside_dhaka"] as const;
export type PromotionZone = (typeof PROMOTION_ZONES)[number];

/** The fields a rule needs; dates may arrive as ISO strings from JSON. */
export interface PromotionRule {
  id: string;
  title: string;
  isActive: boolean;
  paymentMethods: string[];
  zones: string[];
  minOrderAmount: number | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

export interface PromotionContext {
  paymentMethod: string;
  zone: string;
  /** Cart subtotal before delivery. */
  subtotal: number;
  now?: Date;
}

const time = (value: Date | string | null) => (value === null ? null : new Date(value).getTime());

/** Switched on and inside its date window (open-ended when a date is missing). */
export function isPromotionLive(promo: Pick<PromotionRule, "isActive" | "startsAt" | "endsAt">, now = new Date()): boolean {
  if (!promo.isActive) return false;
  const at = now.getTime();
  const start = time(promo.startsAt);
  const end = time(promo.endsAt);
  return (start === null || at >= start) && (end === null || at <= end);
}

/**
 * A promotion with a personal time limit (personalWindowMinutes) runs, for
 * one visitor, from the moment they first saw it: this is that visitor's end —
 * first seen + the window, never later than the promotion's own end. Null when
 * there is no limit at all. The server records "first seen", so the
 * countdown a visitor is shown is the one checkout enforces.
 */
export function personalEndsAt(
  promo: { endsAt: Date | string | null; personalWindowMinutes: number | null },
  firstSeenAt: Date,
): Date | null {
  const end = time(promo.endsAt);
  if (!promo.personalWindowMinutes) return end === null ? null : new Date(end);
  const personal = firstSeenAt.getTime() + promo.personalWindowMinutes * 60_000;
  return new Date(end === null ? personal : Math.min(end, personal));
}

/** The first live promotion that makes this order's delivery free, or null. */
export function findFreeDelivery<T extends PromotionRule>(promos: readonly T[], ctx: PromotionContext): T | null {
  const now = ctx.now ?? new Date();
  return (
    promos.find(
      (promo) =>
        isPromotionLive(promo, now) &&
        promo.paymentMethods.includes(ctx.paymentMethod) &&
        promo.zones.includes(ctx.zone) &&
        (promo.minOrderAmount === null || ctx.subtotal >= promo.minOrderAmount),
    ) ?? null
  );
}
