// Shared by the storefront collector, the ingestion route and the dashboard.
// No runtime dependencies, so it is safe in every bundle.

/** Events the browser sends. order_complete is written by the server only. */
export const COLLECT_TYPES = ["page_view", "product_view", "add_to_cart", "buy_now", "checkout_start"] as const;
export type CollectType = (typeof COLLECT_TYPES)[number];
export type AnalyticsEventType = CollectType | "order_complete";

export interface CollectPayload {
  type: CollectType;
  path: string;
  hostname: string | null;
  visitorId: string;
  sessionId: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  adClick: "google" | "facebook" | null;
  label: string | null;
  productId: string | null;
  value: number | null;
}
