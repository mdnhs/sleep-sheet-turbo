"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import React from "react";
import { useLanguage } from "@/hooks/use-language";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import { enrichColorWithAddOnPrices } from "@/lib/utils";
import FallbackImage from "@/components/ui/fallback-image";
import { OrderSummarySkeleton } from "./checkout-skeleton";

function OrderSummeryCard() {
  const mounted = useHasMounted();
  const userItems = useCartStore((state) => state.items);
  const guestItems = useCartStore((state) => state.guestItems);
  const shippingCost = useCartStore((state) => state.shipping);
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();

  if (!mounted) {
    return <OrderSummarySkeleton />;
  }

  const cartItems = [...userItems, ...guestItems];
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const shipping = shippingCost;
  const total = subtotal + shipping;

  return (
    <Card className="w-full bg-card rounded-xl lg:rounded-2xl overflow-hidden gap-3 py-3 ring-0">
      <CardHeader className="py-2.5 px-3 lg:pt-4 lg:pb-3 lg:px-4 border-b border-border/40 !pb-2.5 lg:!pb-3">
        <CardTitle className="flex items-center gap-2">
          <p className="text-sm lg:text-base font-bold">{t("orderSummary")}</p>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 lg:space-y-3 p-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-2.5">
        {cartItems?.map((cartItem, idx) => (
            <div key={cartItem.id} className="flex gap-2 lg:gap-3 items-center">
              <div className="h-10 w-10 lg:h-14 lg:w-14 shrink-0 overflow-hidden rounded-lg lg:rounded-xl border border-border/40 bg-muted/20 relative">
                <FallbackImage
                  src={cartItem?.image}
                  alt={cartItem?.name}
                  fill
                  sizes="(max-width: 1024px) 40px, 56px"
                  priority={idx === 0}
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h1 className="text-[11px] lg:text-xs font-semibold leading-tight truncate">{cartItem.name}</h1>
                  <label className="font-bold text-[11px] lg:text-xs whitespace-nowrap">{formatAmount(cartItem.price)}</label>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2 mt-0.5 text-[9px] lg:text-[10px] font-medium text-muted-foreground">
                  <span>{t("qty")}: {cartItem.quantity}</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-border"></span>
                  <span>{enrichColorWithAddOnPrices(cartItem.color, cartItem.addOns || (cartItem as unknown as { product?: { addOns?: { name: string; price: number }[] } }).product?.addOns, formatAmount)}</span>
                  {cartItem.size && (
                    <>
                      <span className="w-0.5 h-0.5 rounded-full bg-border"></span>
                      <span>{cartItem.size}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

        <div className="border-t border-border/40 pt-2 lg:pt-3 space-y-1.5 lg:space-y-2">
          <div className="flex justify-between text-[11px] lg:text-xs">
            <span className="text-muted-foreground/80">{t("subtotal")}</span>
            <span className="font-semibold">{formatAmount(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[11px] lg:text-xs">
            <span className="text-muted-foreground/80">{t("shipping")}</span>
            <span className="font-semibold">{shipping > 0 ? formatAmount(shipping) : "—"}</span>
          </div>
          <div className="flex justify-between items-end pt-1.5 lg:pt-2 border-t border-border/40">
            <span className="text-[10px] lg:text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("total")}</span>
            <span className="text-lg lg:text-xl font-black text-foreground tracking-tight">{formatAmount(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderSummeryCard;
