import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { checkoutDrafts, products } from "@/db/schema";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";
import type { CheckoutDraftRow, DraftSummary } from "../lib/types";
import type { Range } from "./filters";

export const MAX_DRAFT_BODY_BYTES = 16_384;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const id = z.string().trim().min(1).max(64);

export const draftPayloadSchema = z.object({
  sessionId: id,
  visitorId: id,
  fullName: text(150),
  phone: z
    .string()
    .max(40)
    .transform((value, ctx) => {
      const phone = normalizeBdPhone(value);
      if (!phone) ctx.addIssue({ code: "custom", message: "Invalid phone" });
      return phone ?? "";
    }),
  email: text(200),
  address: text(500),
  shippingZone: z
    .enum(["inside_dhaka", "outside_dhaka"])
    .nullish()
    .transform((value) => value ?? null),
  items: z
    .array(
      z.object({
        productId: id,
        name: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(999),
        price: z.number().finite().min(0).max(10_000_000),
        size: text(50),
        color: text(50),
      }),
    )
    .min(1)
    .max(50),
});

export type DraftPayload = z.output<typeof draftPayloadSchema>;

/** The beacon body as a validated draft, or null for anything else (bad JSON, no valid phone, empty cart). */
export function parseDraftBody(raw: string): DraftPayload | null {
  if (new TextEncoder().encode(raw).length > MAX_DRAFT_BODY_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = draftPayloadSchema.safeParse(json);
  return result.success ? result.data : null;
}

export function draftValue(items: DraftPayload["items"]): number {
  return Math.round(items.reduce((acc, item) => acc + item.price * item.quantity, 0) * 100) / 100;
}

/**
 * Inserts or refreshes the session's draft. A draft that already converted
 * (or that staff dismissed) is left alone, so a late beacon can't reopen it.
 */
export async function upsertDraft(
  draft: DraftPayload,
  landing: { referrerHost: string | null; utmSource: string | null },
): Promise<void> {
  const fields = {
    visitorId: draft.visitorId,
    fullName: draft.fullName,
    phone: draft.phone,
    email: draft.email,
    address: draft.address,
    shippingZone: draft.shippingZone,
    items: draft.items,
    value: draftValue(draft.items),
    updatedAt: new Date(),
  };
  await db
    .insert(checkoutDrafts)
    .values({ sessionId: draft.sessionId, ...fields, ...landing })
    .onConflictDoUpdate({
      target: checkoutDrafts.sessionId,
      set: fields,
      setWhere: eq(checkoutDrafts.status, "open"),
    });
}

/**
 * Marks the open drafts behind a placed order as converted: the same analytics
 * session, or the same phone (customer switched device or browser). Never rejects.
 */
export async function markDraftConverted(input: {
  orderId: string;
  sessionId?: string | null;
  phone?: string | null;
}): Promise<void> {
  try {
    const phone = input.phone ? normalizeBdPhone(input.phone) : null;
    const match = [
      input.sessionId ? eq(checkoutDrafts.sessionId, input.sessionId) : undefined,
      phone ? eq(checkoutDrafts.phone, phone) : undefined,
    ].filter((cond) => cond !== undefined);
    if (match.length === 0) return;
    await db
      .update(checkoutDrafts)
      .set({ status: "converted", orderId: input.orderId, updatedAt: new Date() })
      .where(and(eq(checkoutDrafts.status, "open"), or(...match)));
  } catch (err) {
    console.error("Checkout draft conversion failed:", err);
  }
}

export type DraftView = "open" | "completed";

const VIEW_STATUSES: Record<DraftView, CheckoutDraftRow["status"][]> = {
  open: ["open"],
  // Closed by staff on a call / WhatsApp. Drafts the customer converted on
  // their own never needed a call, so they're in neither list.
  completed: ["recovered"],
};

/** Drafts whose lead came in (createdAt) inside the dashboard range. */
function capturedIn(range: Range) {
  return and(gte(checkoutDrafts.createdAt, range.start), lte(checkoutDrafts.createdAt, range.end));
}

/**
 * Drafts in one view captured in the range, most recent first. For completed
 * drafts updatedAt is when they completed: the status change is their last write.
 */
export async function listDrafts(view: DraftView, range: Range, limit: number, offset: number): Promise<CheckoutDraftRow[]> {
  const rows = await db
    .select()
    .from(checkoutDrafts)
    .where(and(inArray(checkoutDrafts.status, VIEW_STATUSES[view]), capturedIn(range)))
    .orderBy(desc(checkoutDrafts.updatedAt), desc(checkoutDrafts.id))
    .limit(limit)
    .offset(offset);
  const productIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.productId)))];
  const imageById = new Map<string, string | null>();
  if (productIds.length > 0) {
    const found = await db.select({ id: products.id, images: products.images }).from(products).where(inArray(products.id, productIds));
    for (const product of found) imageById.set(product.id, product.images[0] ?? null);
  }
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    shippingZone: row.shippingZone,
    items: row.items.map((item) => ({ ...item, image: imageById.get(item.productId) ?? null })),
    value: row.value,
    referrerHost: row.referrerHost,
    utmSource: row.utmSource,
    status: row.status,
    orderId: row.orderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * Counts for drafts captured in the range, plus the open carts' value.
 * `total` is open + recovered: drafts the customer converted on their own
 * were never left incomplete, and dismissed ones were dropped by staff
 * (spam, wrong number).
 */
export async function summarizeDrafts(range: Range): Promise<DraftSummary> {
  const byStatus = (status: CheckoutDraftRow["status"]) =>
    sql<number>`count(*) filter (where ${checkoutDrafts.status} = ${status})`.mapWith(Number);
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${checkoutDrafts.status} in ('open', 'recovered'))`.mapWith(Number),
      open: byStatus("open"),
      recovered: byStatus("recovered"),
      value: sql<string | null>`sum(${checkoutDrafts.value}) filter (where ${checkoutDrafts.status} = 'open')`,
    })
    .from(checkoutDrafts)
    .where(capturedIn(range));
  return {
    total: row?.total ?? 0,
    open: row?.open ?? 0,
    recovered: row?.recovered ?? 0,
    value: Number(row?.value ?? 0),
  };
}

/** Staff closed the sale on a call or WhatsApp. Returns false when no open draft had that id. */
export async function recoverDraft(id: number): Promise<boolean> {
  const rows = await db
    .update(checkoutDrafts)
    .set({ status: "recovered", updatedAt: new Date() })
    .where(and(eq(checkoutDrafts.id, id), eq(checkoutDrafts.status, "open")))
    .returning({ id: checkoutDrafts.id });
  return rows.length > 0;
}

/** Staff closed the lead (called, wrong number, spam). Returns false when no open draft had that id. */
export async function dismissDraft(id: number): Promise<boolean> {
  const rows = await db
    .update(checkoutDrafts)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(and(eq(checkoutDrafts.id, id), eq(checkoutDrafts.status, "open")))
    .returning({ id: checkoutDrafts.id });
  return rows.length > 0;
}
