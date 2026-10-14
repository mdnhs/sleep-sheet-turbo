// Telegram alert for checkout drafts the customer walked away from. Every
// minute the server claims the open drafts nobody has touched for
// DRAFT_IDLE_MINUTES and posts each one to an n8n webhook, which formats it
// and sends it to the same Telegram chats as new orders. A draft that turns
// into an order first is marked converted (drafts.ts) and never announced.
//
// Off unless N8N_CHECKOUT_DRAFT_WEBHOOK_URL is set, so only the environment
// that should page staff (production) does.
import { and, asc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { checkoutDrafts } from "@/db/schema";

/** An open draft untouched this long is announced, once. */
export const DRAFT_IDLE_MINUTES = 5;
// Drafts that went idle longer ago than this (server down, alerts switched
// off) are left to the dashboard instead of arriving as a burst.
const LOOKBACK_HOURS = 6;
const BATCH_SIZE = 20;
const CHECK_EVERY_MS = 60 * 1000;

const claimedColumns = {
  id: checkoutDrafts.id,
  fullName: checkoutDrafts.fullName,
  phone: checkoutDrafts.phone,
  address: checkoutDrafts.address,
  shippingZone: checkoutDrafts.shippingZone,
  items: checkoutDrafts.items,
  value: checkoutDrafts.value,
  createdAt: checkoutDrafts.createdAt,
  updatedAt: checkoutDrafts.updatedAt,
};

/**
 * Marks the drafts that are due as notified and returns them. The claim is one
 * UPDATE over a SKIP LOCKED pick, so overlapping runs (a deploy's old and new
 * container) never announce the same draft twice.
 */
export async function claimIdleDrafts(now = new Date()) {
  const idleSince = new Date(now.getTime() - DRAFT_IDLE_MINUTES * 60_000);
  const oldest = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000);
  const due = db
    .select({ id: checkoutDrafts.id })
    .from(checkoutDrafts)
    .where(
      and(
        eq(checkoutDrafts.status, "open"),
        isNull(checkoutDrafts.notifiedAt),
        lte(checkoutDrafts.updatedAt, idleSince),
        gt(checkoutDrafts.updatedAt, oldest),
      ),
    )
    .orderBy(asc(checkoutDrafts.updatedAt))
    .limit(BATCH_SIZE)
    .for("update", { skipLocked: true });
  return db
    .update(checkoutDrafts)
    .set({ notifiedAt: now })
    .where(and(inArray(checkoutDrafts.id, due), isNull(checkoutDrafts.notifiedAt)))
    .returning(claimedColumns);
}

export type ClaimedDraft = Awaited<ReturnType<typeof claimIdleDrafts>>[number];

/** Puts a draft whose alert failed back in line for the next run. */
async function releaseDraft(id: number): Promise<void> {
  await db.update(checkoutDrafts).set({ notifiedAt: null }).where(eq(checkoutDrafts.id, id));
}

/** The webhook body; n8n turns it into the Telegram message. */
export function draftAlertPayload(draft: ClaimedDraft) {
  return {
    draftId: draft.id,
    customerName: draft.fullName,
    customerPhone: draft.phone,
    address: draft.address,
    shippingZone: draft.shippingZone,
    totalAmount: draft.value,
    items: draft.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size ?? null,
      color: item.color ?? null,
    })),
    startedAt: draft.createdAt.toISOString(),
    lastActivityAt: draft.updatedAt.toISOString(),
  };
}

/** Announces every due draft, one webhook call (one Telegram message) each. Returns how many went out. */
export async function sendIdleDraftAlerts(webhookUrl: string, now = new Date()): Promise<number> {
  const drafts = await claimIdleDrafts(now);
  let sent = 0;
  for (const draft of drafts) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftAlertPayload(draft)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`n8n responded ${res.status}`);
      sent++;
    } catch (err) {
      console.error(`Checkout draft alert ${draft.id} failed:`, err);
      await releaseDraft(draft.id).catch((releaseErr) => {
        console.error(`Checkout draft alert ${draft.id} could not be released:`, releaseErr);
      });
    }
  }
  return sent;
}

const timerHolder = globalThis as unknown as { checkoutDraftAlertTimer?: NodeJS.Timeout };

/** Starts the periodic check. No-op without the webhook URL, or when already running. */
export function scheduleDraftAlerts(): void {
  const webhookUrl = process.env.N8N_CHECKOUT_DRAFT_WEBHOOK_URL;
  if (!webhookUrl || timerHolder.checkoutDraftAlertTimer) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendIdleDraftAlerts(webhookUrl);
    } catch (err) {
      console.error("Checkout draft alerts failed:", err);
    } finally {
      running = false;
    }
  };
  timerHolder.checkoutDraftAlertTimer = setInterval(tick, CHECK_EVERY_MS);
  timerHolder.checkoutDraftAlertTimer.unref();
}
