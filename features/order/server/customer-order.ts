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
