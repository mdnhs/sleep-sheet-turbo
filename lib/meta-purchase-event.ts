export interface PurchaseTrackingPayload {
  value: number;
  currency: string;
  orderId: string;
  orderNumber?: string;
  eventId: string;
  contents: { id: string; quantity: number; item_price: number }[];
  numItems: number;
}

/**
 * Deterministic Meta Purchase dedup key.
 *
 * Browser Pixel must pass this as `eventID`; CAPI must pass the same value as
 * `event_id`.
 */
export function purchaseEventId(orderId: string): string {
  return `purchase_${orderId}`;
}
