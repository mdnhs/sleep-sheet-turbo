"use client";

import { afterNextPaint } from "@/lib/after-next-paint";
import { collect, type CollectExtra } from "@/features/web-analytics/lib/collector";
import { COLLECT_TYPES, type CollectType } from "@/features/web-analytics/lib/types";

export type TrafficEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "buy_now"
  | "search"
  | "wishlist_add"
  | "checkout_start"
  | "order_complete";

// Every event goes to Google Analytics (gtag). Page views and the shopping
// events in COLLECT_TYPES also go to the store's own analytics
// (features/web-analytics), stored in the self-hosted Postgres. That used to
// be impossible on serverless Neon, where a write per page view kept the
// compute awake around the clock (the old traffic_events table, dropped in
// migration 0013). order_complete is recorded by the checkout route instead.
const isCollectType = (type: TrafficEventType): type is CollectType =>
  (COLLECT_TYPES as readonly string[]).includes(type);

export function toCollectExtra(
  label?: string,
  meta?: Record<string, string | number | boolean>,
): CollectExtra {
  const price = typeof meta?.price === "number" ? meta.price : undefined;
  const quantity = typeof meta?.quantity === "number" ? meta.quantity : 1;
  return {
    label: label ?? null,
    productId: typeof meta?.productId === "string" ? meta.productId : null,
    value: price === undefined ? null : price * quantity,
  };
}

export function trackEvent(
  type: TrafficEventType,
  path: string,
  label?: string,
  meta?: Record<string, string | number | boolean>
) {
  try {
    if (typeof window === "undefined") return;
    if (path.startsWith("/dashboard") || window.location?.pathname?.startsWith("/dashboard")) return;

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    const firstParty = isCollectType(type);
    if (!firstParty && typeof gtag !== "function") return;

    // After the next paint, in order with lib/gtm's pushes: gtag() is a
    // dataLayer push too, so calling it inside a click handler ran GTM's
    // tags inside that tap. The beacon waits for the same reason.
    afterNextPaint(() => {
      if (firstParty) collect(type, path, toCollectExtra(label, meta));
      if (typeof gtag === "function") {
        gtag("event", type, {
          page_path: path,
          event_label: label,
          ...meta,
        });
      }
    });
  } catch {}
}
