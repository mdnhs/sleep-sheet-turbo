import type {
  GtmAddToCartPayload,
  GtmBeginCheckoutPayload,
  GtmEcommerceItem,
  GtmPurchasePayload,
  GtmRemoveFromCartPayload,
  GtmUserData,
  GtmViewItemPayload,
} from "./events";

export * from "./events";
export * from "./user-identity";

import { getGtmIdentity } from "./user-identity";
import { afterNextPaint } from "@/lib/after-next-paint";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}

const trackedGtmPurchaseIds = new Set<string>();

/**
 * Format raw phone number into standard E.164 format for Google Ads Enhanced Conversions.
 */
export function formatE164Phone(rawPhone?: string | null): string | undefined {
  if (!rawPhone) return undefined;
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("880") && digits.length >= 13) return `+${digits}`;
  if (digits.startsWith("01") && digits.length === 11) return `+88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `+880${digits}`;
  return rawPhone.startsWith("+") ? rawPhone : `+${digits}`;
}

/**
 * Split a full name into first and last name for Google Ads user-provided data.
 */
export function splitFullName(name?: string | null): { first_name?: string; last_name?: string } {
  if (!name) return {};
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return {};
  if (words.length === 1) return { first_name: words[0] };

  const lastName = words.pop();
  const firstName = words.join(" ");
  return {
    first_name: firstName,
    last_name: lastName,
  };
}


/**
 * A deduplication key for one occurrence of a tracking event.
 *
 * Meta treats a browser Pixel event and a Conversions API event as the same
 * event only when both carry the same `event_id`. This store sends both: the
 * web container fires the Meta Pixel in the browser, and the same dataLayer
 * push travels on to the server container (the gtm_server_url host), whose Stape
 * CAPI tag fires on every GA4 event. Without a shared id, Meta counts each
 * one twice — every AddToCart, ViewContent, InitiateCheckout and Search was
 * being double counted, and Purchase too, because the browser tag prefixed
 * the transaction id with "purchase_" while the server tag read the raw
 * transaction id off the ecommerce object.
 *
 * Generating it here, once per push, is what makes the two sides agree:
 * both read the same value out of the same dataLayer event.
 */
function randomEventId(event: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${event}_${unique}`;
}

/**
 * The Purchase dedup key, derived from the transaction id rather than random.
 *
 * Deterministic on purpose: a customer refreshing the success page, or
 * arriving at it twice, must produce the same id so Meta collapses the
 * repeats instead of counting another sale.
 *
 * The `purchase_` prefix matches exactly what the web container's Meta Pixel
 * Purchase tag already builds from `{{dlv - ecommerce.transaction_id}}`, so
 * this is correct whether or not that tag is switched over to read
 * `event_id` — there is no moment where the two disagree.
 *
 * Distinct from purchaseEventId() in lib/meta-purchase-event.ts, which keys
 * off the order's database id for the in-house CAPI path. This one keys off
 * the transaction id the dataLayer actually carries (the order number).
 */
export function purchaseGtmEventId(transactionId: string): string {
  const id = String(transactionId);
  return id.startsWith("purchase_") ? id : `purchase_${id}`;
}

/**
 * SHA-256, hex encoded — the form Meta's Conversions API expects for the
 * email and phone it matches on.
 *
 * Hashed here rather than sent raw because the transport is a GA4 event
 * parameter: raw email and phone travelling that way is personally
 * identifiable data in an analytics stream, which Google's own policy
 * forbids and which would put the property at risk. Meta is unaffected by
 * the choice — its CAPI wants SHA-256 anyway, and a server tag that would
 * otherwise hash a raw value recognises one that already is.
 *
 * The browser Pixel is a separate path and still reads the raw values out of
 * `user_data`: the Pixel SDK does its own hashing before anything leaves the
 * page, so nothing raw is transmitted there either.
 */
async function sha256Hex(value: string): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/**
 * Meta's normalisation before hashing: an email lowercased and trimmed, a
 * phone reduced to digits with its country code and no leading "+". Anything
 * missing, or a browser without Web Crypto (it needs a secure context),
 * yields undefined rather than a wrong hash — a missing identifier costs
 * match quality, a wrong one costs match quality and is never noticed.
 */
export async function hashIdentifiers(input: {
  email?: string | null;
  phone?: string | null;
}): Promise<{ email_sha256?: string; phone_sha256?: string }> {
  const email = input.email?.trim().toLowerCase();
  const phoneDigits = formatE164Phone(input.phone)?.replace(/\D/g, "");

  const [email_sha256, phone_sha256] = await Promise.all([
    email ? sha256Hex(email) : Promise.resolve(undefined),
    phoneDigits ? sha256Hex(phoneDigits) : Promise.resolve(undefined),
  ]);

  return { email_sha256, phone_sha256 };
}

/**
 * Safely push an event or object to Google Tag Manager dataLayer.
 *
 * The push itself happens after the next paint (see lib/after-next-paint):
 * these are called from click handlers — Add to cart, Order now — and GTM
 * fires the matching tags synchronously inside push(), which made them part
 * of the tap's INP. The payload (event_id included) is built now; only its
 * delivery waits, and pushes keep their order.
 */
export function pushToDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (window.location?.pathname?.startsWith("/dashboard")) return;
  afterNextPaint(() => {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
    } catch (error) {
      console.error("[GTM] Failed to push to dataLayer:", error);
    }
  });
}

/**
 * Standard GA4 Ecommerce event pusher:
 * Google Tag Manager best practice requires clearing previous `ecommerce`
 * object before pushing a new ecommerce event to avoid key pollution.
 */
export function trackGtmEcommerce(
  event: "purchase" | "add_to_cart" | "remove_from_cart" | "begin_checkout" | "view_item" | string,
  ecommerce: Record<string, unknown>,
  extraData?: Record<string, unknown>,
  /** Override the generated dedup key. Purchase passes a deterministic one. */
  eventId?: string,
): void {
  if (typeof window === "undefined") return;

  pushToDataLayer({ ecommerce: null });
  pushToDataLayer({
    event,
    // Read by the web container's Meta Pixel tags as `eventID`, and forwarded
    // to the server container so its CAPI tag sends the same `event_id`.
    event_id: eventId || randomEventId(event),
    ...withIdentity(extraData),
    ecommerce,
  });
}

/**
 * Attaches whoever we know the visitor to be to an outgoing event.
 *
 * Done here so every event gets it rather than only the ones whose call site
 * remembered: view_item, add_to_cart, begin_checkout and remove_from_cart
 * all used to travel with no identifiers at all. A caller that supplies its
 * own `user_data` wins field by field — Purchase knows the buyer's details
 * from the order it just read, which beats whatever the session knew, and a
 * guest checkout has details the signed-in identity does not.
 */
function withIdentity(extraData?: Record<string, unknown>): Record<string, unknown> | undefined {
  const identity = getGtmIdentity();
  const explicit = extraData?.user_data as GtmUserData | undefined;
  if (!identity && !explicit) return extraData;

  const merged: GtmUserData = { ...identity };
  for (const [key, value] of Object.entries(explicit ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return { ...extraData, user_data: merged };
}

/**
 * Track GA4 & Google Ads Purchase event with deduplication guard and Enhanced Conversions.
 * Returns true if event was pushed, false if already tracked.
 */
export function trackGtmPurchase(payload: GtmPurchasePayload): boolean {
  if (!payload || !payload.transaction_id) return false;

  const orderId = String(payload.transaction_id);
  const rawOrderId = payload.order_id ? String(payload.order_id) : undefined;
  const guardKey = `gtm_purchase_tracked_${orderId}`;
  const rawGuardKey = rawOrderId ? `gtm_purchase_tracked_${rawOrderId}` : undefined;

  let alreadyTracked =
    trackedGtmPurchaseIds.has(orderId) ||
    (rawOrderId ? trackedGtmPurchaseIds.has(rawOrderId) : false);

  if (typeof window !== "undefined") {
    try {
      alreadyTracked =
        alreadyTracked ||
        sessionStorage.getItem(guardKey) === "1" ||
        (rawGuardKey ? sessionStorage.getItem(rawGuardKey) === "1" : false);
    } catch {
      /* sessionStorage unavailable */
    }
  }

  if (alreadyTracked) {
    return false;
  }

  trackedGtmPurchaseIds.add(orderId);
  if (rawOrderId) trackedGtmPurchaseIds.add(rawOrderId);

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(guardKey, "1");
      if (rawGuardKey) sessionStorage.setItem(rawGuardKey, "1");
    } catch {
      /* sessionStorage unavailable */
    }
  }

  const currency = (payload.currency || "BDT")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3) || "BDT";
  const rawValue = Number(payload.value);
  const safeValue = !isNaN(rawValue) && rawValue > 0 ? Number(rawValue.toFixed(2)) : 0.01;

  const ecommerceData = {
    transaction_id: orderId,
    value: safeValue,
    currency,
    tax: payload.tax !== undefined ? Number(payload.tax) : 0,
    shipping: payload.shipping !== undefined ? Number(payload.shipping) : 0,
    coupon: payload.coupon,
    items: payload.items.map((item, idx) => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      currency: item.currency || currency,
      price: item.price !== undefined ? Number(item.price) : 0,
      quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
      item_variant: item.item_variant,
      item_category: item.item_category,
      index: item.index ?? idx + 1,
    })),
  };

  // Google Ads Enhanced Conversions payload (fbc rides along for a GTM
  // Data Layer Variable to feed the Facebook Pixel tag's Advanced Matching —
  // Google Ads itself ignores the field).
  const userData: Record<string, unknown> | undefined = payload.user_data
    ? {
        email: payload.user_data.email || undefined,
        phone_number: formatE164Phone(payload.user_data.phone_number),
        address: payload.user_data.address
          ? {
              first_name: payload.user_data.address.first_name,
              last_name: payload.user_data.address.last_name,
              street: payload.user_data.address.street,
              city: payload.user_data.address.city,
              region: payload.user_data.address.region,
              postal_code: payload.user_data.address.postal_code,
              country: payload.user_data.address.country || "BD",
            }
          : undefined,
        fbc: payload.user_data.fbc || undefined,
        external_id: payload.user_data.external_id || undefined,
        // Hashed copies for the server-side path — see hashIdentifiers.
        email_sha256: payload.user_data.email_sha256 || undefined,
        phone_sha256: payload.user_data.phone_sha256 || undefined,
      }
    : undefined;

  trackGtmEcommerce(
    "purchase",
    ecommerceData,
    userData ? { user_data: userData } : undefined,
    purchaseGtmEventId(orderId),
  );
  return true;
}

/**
 * Track GA4 & Google Ads Add to Cart event.
 */
export function trackGtmAddToCart(payload: GtmAddToCartPayload): void {
  if (!payload || !payload.items?.length) return;

  if (typeof window !== "undefined") {
    try {
      const firstId = payload.items[0]?.item_id || "";
      const key = `gtm_add_to_cart_${firstId}`;
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (last && now - Number(last) < 2000) {
        return;
      }
      sessionStorage.setItem(key, String(now));
    } catch {
      /* ignore */
    }
  }

  const currency = (payload.currency || "BDT")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3) || "BDT";
  const numValue = payload.value !== undefined ? Number(payload.value) : undefined;
  const safeValue = numValue !== undefined && !isNaN(numValue) && numValue > 0 ? Number(numValue.toFixed(2)) : undefined;

  const ecommerceData = {
    currency,
    value: safeValue,
    items: payload.items.map((item, idx) => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      currency: item.currency || currency,
      price: item.price !== undefined ? Number(item.price) : 0,
      quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
      item_variant: item.item_variant,
      item_category: item.item_category,
      index: item.index ?? idx + 1,
    })),
  };

  trackGtmEcommerce("add_to_cart", ecommerceData);
}

/**
 * Track GA4 & Google Ads Begin Checkout event.
 */
export function trackGtmBeginCheckout(payload: GtmBeginCheckoutPayload): void {
  if (!payload || !payload.items?.length) return;

  if (typeof window !== "undefined") {
    try {
      const last = sessionStorage.getItem("gtm_begin_checkout_ts");
      const now = Date.now();
      if (last && now - Number(last) < 8000) {
        // Skip duplicate begin_checkout if fired within 8s (e.g. Buy Now button followed by /checkout page load)
        return;
      }
      sessionStorage.setItem("gtm_begin_checkout_ts", String(now));
    } catch {
      /* ignore */
    }
  }

  const currency = (payload.currency || "BDT")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3) || "BDT";
  const numValue = payload.value !== undefined ? Number(payload.value) : undefined;
  const safeValue = numValue !== undefined && !isNaN(numValue) && numValue > 0 ? Number(numValue.toFixed(2)) : undefined;

  const ecommerceData = {
    currency,
    value: safeValue,
    coupon: payload.coupon,
    items: payload.items.map((item, idx) => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      currency: item.currency || currency,
      price: item.price !== undefined ? Number(item.price) : 0,
      quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
      item_variant: item.item_variant,
      item_category: item.item_category,
      index: item.index ?? idx + 1,
    })),
  };

  trackGtmEcommerce("begin_checkout", ecommerceData);
}

/**
 * Track GA4 View Item (Product Details) event.
 */
export function trackGtmViewItem(payload: GtmViewItemPayload): void {
  if (!payload || !payload.items?.length) return;

  const currency = (payload.currency || "BDT").trim().toUpperCase().slice(0, 3) || "BDT";
  const numValue = payload.value !== undefined ? Number(payload.value) : undefined;
  const safeValue = numValue !== undefined && !isNaN(numValue) && numValue > 0 ? Number(numValue.toFixed(2)) : undefined;

  const ecommerceData = {
    currency,
    value: safeValue,
    items: payload.items.map((item, idx) => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      currency: item.currency || currency,
      price: item.price !== undefined ? Number(item.price) : 0,
      quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
      item_variant: item.item_variant,
      item_category: item.item_category,
      index: item.index ?? idx + 1,
    })),
  };

  const userData: Record<string, unknown> | undefined = payload.user_data
    ? {
        email: payload.user_data.email || undefined,
        phone_number: formatE164Phone(payload.user_data.phone_number),
        address: payload.user_data.address || undefined,
        fbc: payload.user_data.fbc || undefined,
      }
    : undefined;

  trackGtmEcommerce(
    "view_item",
    ecommerceData,
    userData ? { user_data: userData } : undefined,
  );
}

/**
 * Track GA4 Remove from Cart event.
 */
export function trackGtmRemoveFromCart(payload: GtmRemoveFromCartPayload): void {
  if (!payload || !payload.items?.length) return;

  const currency = payload.currency || "BDT";
  const ecommerceData = {
    currency,
    value: payload.value !== undefined ? Number(payload.value) : undefined,
    items: payload.items.map((item, idx) => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      currency: item.currency || currency,
      price: item.price !== undefined ? Number(item.price) : 0,
      quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
      item_variant: item.item_variant,
      item_category: item.item_category,
      index: item.index ?? idx + 1,
    })),
  };

  trackGtmEcommerce("remove_from_cart", ecommerceData);
}

/**
 * Track GA4 Search event with search term.
 */
export function trackGtmSearch(searchTerm: string): void {
  if (!searchTerm || !searchTerm.trim()) return;
  const term = searchTerm.trim();
  pushToDataLayer({
    event: "search",
    event_id: randomEventId("search"),
    search_term: term,
  });
}

