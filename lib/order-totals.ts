type TotalsOrder = {
  subtotal: number;
  deliveryCharge: number;
  shippingCost: number;
  totalAmount: number;
  refundedAmount?: number | null;
  items: { quantity: number; costPrice?: number | null }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Positive = discount, negative = the admin charged more than products + delivery.
export function orderDiscount(order: Pick<TotalsOrder, "subtotal" | "deliveryCharge" | "totalAmount">) {
  return round2(order.subtotal + order.deliveryCharge - order.totalAmount);
}

export function orderBoughtPrice(order: Pick<TotalsOrder, "items">) {
  return round2(order.items.reduce((sum, i) => sum + (i.costPrice ?? 0) * i.quantity, 0));
}

export function orderProfit(order: TotalsOrder) {
  return round2(
    order.totalAmount - (order.refundedAmount ?? 0) - orderBoughtPrice(order) - order.shippingCost,
  );
}

// Item edits move the total by the subtotal change so a manual discount survives.
export function totalAfterSubtotalChange(currentTotal: number, oldSubtotal: number, newSubtotal: number) {
  return round2(currentTotal + newSubtotal - oldSubtotal);
}
