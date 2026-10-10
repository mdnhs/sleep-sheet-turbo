// The order's `reference` column remembers which bKash paymentID we issued
// for it, so a callback can prove it belongs to this order. Kept free of DB
// imports so it can be tested directly.
export const paymentIdRef = (paymentID: string) => `bKash paymentID: ${paymentID}`;

/** True when `reference` is the paymentID we issued for this order. */
export function matchesIssuedPayment(reference: string | null, paymentID: string): boolean {
  return reference === paymentIdRef(paymentID);
}

/**
 * May this callback change the order at all? bKash's redirect always carries
 * the paymentID (success, failure or cancel). A request without the one we
 * issued didn't come from bKash's page for this order (for example, someone
 * who only knows the order id) and must not cancel it.
 */
export function canSettleCallback(reference: string | null, paymentID: string | undefined): boolean {
  if (!paymentID) return false;
  return matchesIssuedPayment(reference, paymentID);
}
