// Shared by the storefront collector, the ingestion route and the dashboard.
// No runtime dependencies, so it is safe in every bundle.
import type { BucketUnit } from "./buckets";


/** Events the browser sends. order_complete is written by the server only. */
export const COLLECT_TYPES = ["page_view", "product_view", "add_to_cart", "buy_now", "checkout_start", "checkout_field"] as const;

/** Checkout form fields reported (label of a checkout_field event) once filled. Never their values. */
export const CHECKOUT_FIELDS = ["fullName", "phone", "address"] as const;
export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];
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

export interface Kpis {
  visitors: number;
  pageViews: number;
  sessions: number;
  bounced: number;
  bounceRate: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

/** One chart bucket. `bucket` is Dhaka wall-clock time, "YYYY-MM-DDTHH:mm:ss". */
export interface SeriesPoint {
  bucket: string;
  visitors: number;
  pageViews: number;
  sessions: number;
  bounced: number;
  orders: number;
  revenue: number;
}

export interface OverviewResponse {
  kpis: Kpis;
  previous: Kpis;
  series: SeriesPoint[];
  unit: BucketUnit;
}

export interface BreakdownRow {
  key: string | null;
  visitors: number;
  orders: number;
  revenue: number;
}

export interface Funnel {
  visited: number;
  viewedProduct: number;
  addedToCart: number;
  startedCheckout: number;
  enteredName: number;
  enteredPhone: number;
  enteredAddress: number;
  ordered: number;
}

export interface CheckoutDraftRow {
  id: number;
  fullName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  shippingZone: string | null;
  items: { productId: string; name: string; quantity: number; price: number; size?: string | null; color?: string | null; image?: string | null }[];
  value: number;
  referrerHost: string | null;
  utmSource: string | null;
  status: "open" | "converted" | "recovered" | "dismissed";
  orderId: string | null;
  /** When the lead came in; the dashboard range filters on this. */
  createdAt: string;
  updatedAt: string;
}

export interface DraftSummary {
  /** Open + recovered: excludes drafts the customer converted on their own and ones staff dismissed. */
  total: number;
  open: number;
  /** Closed by staff on a call / WhatsApp. */
  recovered: number;
  /** Cart value of the open drafts. */
  value: number;
}

export interface ProductRow {
  productId: string;
  name: string;
  image: string | null;
  views: number;
  addedToCart: number;
  orders: number;
}

export interface LiveSnapshot {
  online: number;
  pages: { path: string; visitors: number }[];
}
