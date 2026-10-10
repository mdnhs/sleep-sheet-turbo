/**
 * True when booking would create a second consignment for an order that
 * already has one. Steadfast charges per consignment and the customer could
 * receive two parcels, so a re-book has to be explicit (`force`).
 */
export function isAlreadyBooked(order: { trackingNumber: string | null }, force = false): boolean {
  return !force && Boolean(order.trackingNumber?.trim());
}
