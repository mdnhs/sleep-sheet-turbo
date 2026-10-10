// Helpers for the public "track your order" lookup. A phone number is not a
// secret (anyone can type one in), so on its own it may only show what was
// ordered and where it stands. The order number unlocks the full order.

type TrackableRow = {
  status: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: Date | string;
  items: {
    id: string;
    quantity: number;
    price: number;
    size: string | null;
    color: string | null;
    product: { name: string; images: string[] } | null;
  }[];
};

/** No name, address, note, order id/number or tracking code. */
export function toOrderSummary(row: TrackableRow) {
  return {
    status: row.status,
    paymentMethod: row.paymentMethod,
    totalAmount: row.totalAmount,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      color: item.color,
      product: item.product ? { name: item.product.name, images: item.product.images } : null,
    })),
  };
}

/** Customers type order numbers in any case, sometimes with spaces. */
export function sameOrderNumber(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  return norm(a) === norm(b);
}
