type ItemLike = {
  costPrice: number | null;
  product: { addOns: { name: string; price: number; costPrice?: number }[] } | null;
};

/**
 * The order as a customer may see it: the same shape staff get (the RPC
 * client types off one handler) with what the store paid blanked, meaning
 * each line item's cost price and the cost price of every add-on on the
 * embedded product.
 */
export function withoutCostPrices<T extends { items: ItemLike[] }>(order: T): T {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      costPrice: null,
      product: item.product
        ? {
            ...item.product,
            addOns: item.product.addOns.map((addOn) => {
              const copy = { ...addOn };
              delete copy.costPrice;
              return copy;
            }),
          }
        : item.product,
    })),
  } as T;
}

/**
 * GET /orders/:id for anyone without orders:read. Blanked rather than deleted,
 * so the response keeps one shape whoever asks for it (the RPC client types
 * off the handler). `reference` goes too: for a pending bKash order it holds
 * the paymentID, which is what /api/bkash/callback checks, so it must not ride
 * along on a link a customer can forward.
 */
const BLANKED = {
  reference: null,
  ipAddress: null,
  userAgent: null,
  deviceOs: null,
  browserName: null,
  fbc: null,
  gclid: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  landingReferrer: null,
  landingSource: null,
  idempotencyKey: null,
  user: null,
  OrderTimelineEvent: [] as never[],
  paymentLogs: [] as never[],
};

export function toCustomerOrder<T extends { items: ItemLike[]; deliveryCharge: number }>(
  order: T
): Omit<T, keyof typeof BLANKED> & typeof BLANKED & { shippingCost: number } {
  return {
    ...withoutCostPrices(order),
    ...BLANKED,
    OrderTimelineEvent: [],
    shippingCost: order.deliveryCharge,
  };
}
