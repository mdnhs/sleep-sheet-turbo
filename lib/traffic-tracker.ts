"use client";

import { afterNextPaint } from "@/lib/after-next-paint";

export type TrafficEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "buy_now"
  | "search"
  | "wishlist_add"
  | "checkout_start"
  | "order_complete";

// Events used to be written to a `traffic_events` table as well. Every page
// view was a database write, which kept the serverless compute awake around
// the clock and burned the whole monthly compute quota. Analytics now go to
// Google Analytics only — gtag runs entirely in the browser and costs no
// database time.
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
    if (typeof gtag !== "function") return;

    // After the next paint, in order with lib/gtm's pushes: gtag() is a
    // dataLayer push too, so calling it inside a click handler ran GTM's
    // tags inside that tap.
    afterNextPaint(() => {
      gtag("event", type, {
        page_path: path,
        event_label: label,
        ...meta,
      });
    });
  } catch {}
}
