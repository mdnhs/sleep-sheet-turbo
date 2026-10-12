import { unstable_cache } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promotionClaims, promotions } from "@/db/schema";
import { cacheTag } from "@/lib/cache-tag";
import { isPromotionLive, personalEndsAt, PROMOTION_PAYMENT_METHODS, PROMOTION_ZONES } from "@/lib/promotions";
import type { Promotion } from "../types";

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((value) => (value ? new Date(value) : null));

/** Create / update body. The same schema the admin form validates with. */
export const promotionInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((value) => value || null),
    paymentMethods: z.array(z.enum(PROMOTION_PAYMENT_METHODS)).min(1),
    zones: z.array(z.enum(PROMOTION_ZONES)).min(1),
    minOrderAmount: z.number().finite().min(0).max(10_000_000).nullish().transform((value) => value ?? null),
    // Up to a week per visitor.
    personalWindowMinutes: z.number().int().min(1).max(10_080).nullish().transform((value) => value ?? null),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean(),
  })
  .refine((p) => !p.startsAt || !p.endsAt || p.startsAt <= p.endsAt, {
    message: "End date must be after the start date",
    path: ["endsAt"],
  });

export type PromotionInput = z.output<typeof promotionInputSchema>;

function toPromotion(row: typeof promotions.$inferSelect): Promotion {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    paymentMethods: row.paymentMethods,
    zones: row.zones,
    minOrderAmount: row.minOrderAmount,
    personalWindowMinutes: row.personalWindowMinutes,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPromotions(): Promise<Promotion[]> {
  const rows = await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  return rows.map(toPromotion);
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const [row] = await db.insert(promotions).values(input).returning();
  return toPromotion(row);
}

export async function updatePromotion(id: string, input: PromotionInput): Promise<Promotion | null> {
  const [row] = await db
    .update(promotions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(promotions.id, id))
    .returning();
  return row ? toPromotion(row) : null;
}

export async function deletePromotion(id: string): Promise<Promotion | null> {
  const [row] = await db.delete(promotions).where(eq(promotions.id, id)).returning();
  return row ? toPromotion(row) : null;
}

/**
 * Switched-on promotions, cached under the "promotions" tag that every admin
 * write invalidates. The date window is checked by the caller against the
 * current time (isPromotionLive), so a promotion starts and ends on time even
 * while this list is cached.
 */
const switchedOnPromotions = unstable_cache(
  async (): Promise<Promotion[]> => {
    const rows = await db
      .select()
      .from(promotions)
      .where(eq(promotions.isActive, true))
      .orderBy(desc(promotions.createdAt));
    return rows.map(toPromotion);
  },
  ["promotions-switched-on"],
  { revalidate: 3600, tags: [cacheTag("promotions")] },
);

/**
 * Promotions live right now. Never throws: checkout and the storefront must
 * keep working (at the normal delivery charge) if this read fails, e.g. before
 * the promotions migration is applied.
 */
export async function getLivePromotions(now = new Date()): Promise<Promotion[]> {
  try {
    return (await switchedOnPromotions()).filter((promo) => isPromotionLive(promo, now));
  } catch (err) {
    console.error("Promotions read failed:", err);
    return [];
  }
}

/** First-party visitor ids (lib/visitor-id.ts) are short random strings. */
export const visitorIdSchema = z.string().trim().min(8).max(64);

/**
 * Live promotions as one visitor sees them. A promotion with a personal time
 * limit runs, for this visitor, from when they first saw it: that moment is
 * recorded now (the first time only), its endsAt becomes the visitor's own
 * end, and it drops out once that has passed. Promotions without a limit, or
 * reads without a visitor id, are returned unchanged. Never throws: on a
 * database error the shared list is returned.
 */
export async function personalizePromotions(
  live: Promotion[],
  visitorId: string | null | undefined,
  now = new Date(),
): Promise<Promotion[]> {
  const personal = live.filter((promo) => promo.personalWindowMinutes);
  if (!visitorId || personal.length === 0) return live;
  const ids = personal.map((promo) => promo.id);
  try {
    await db
      .insert(promotionClaims)
      .values(ids.map((promotionId) => ({ promotionId, visitorId })))
      .onConflictDoNothing();
    const claims = await db
      .select()
      .from(promotionClaims)
      .where(and(eq(promotionClaims.visitorId, visitorId), inArray(promotionClaims.promotionId, ids)));
    const firstSeen = new Map(claims.map((claim) => [claim.promotionId, claim.firstSeenAt]));
    return live.flatMap((promo) => {
      const seen = promo.personalWindowMinutes ? firstSeen.get(promo.id) : undefined;
      if (!seen) return [promo];
      const yours = { ...promo, endsAt: personalEndsAt(promo, seen)?.toISOString() ?? null };
      return isPromotionLive(yours, now) ? [yours] : [];
    });
  } catch (err) {
    console.error("Promotion claims failed:", err);
    return live;
  }
}
