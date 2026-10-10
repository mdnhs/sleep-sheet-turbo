"use client";
import OrderSummeryCard from "@/features/checkout/components/order-summery-card";
import ShippingInformationCard from "@/features/checkout/components/shipping-information-card";

import { useCartStore } from "@/features/cart/state/use-cart-store";
import React, { useEffect, useRef } from "react";
import { getOrCreateCheckoutIdempotencyKey } from "@/lib/checkout-idempotency";
import { trackGtmBeginCheckout } from "@/lib/gtm";
import { collect } from "@/features/web-analytics/lib/collector";

interface CheckoutClientProps {
  initialSettings?: Record<string, string> | null;
}

function CheckoutClient({ initialSettings }: CheckoutClientProps) {
  const cartItems = useCartStore((state) => state.items);
  const guestItems = useCartStore((state) => state.guestItems);
  const totalItems = [...cartItems, ...guestItems];
  const hasTrackedCheckoutRef = useRef(false);

  useEffect(() => {
    // Establish the order-creation idempotency key once, when the checkout
    // page loads, so every submit for this cart carries the same key.
    getOrCreateCheckoutIdempotencyKey();
  }, []);

  useEffect(() => {
    if (totalItems.length === 0 || hasTrackedCheckoutRef.current) return;
    hasTrackedCheckoutRef.current = true;

    const totalValue = totalItems.reduce(
      (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    const track = () => {
      trackGtmBeginCheckout({
        currency: "BDT",
        value: totalValue,
        items: totalItems.map((item, idx) => ({
          item_id: item.productId || item.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
          item_variant: [item.size, item.color].filter(Boolean).join(" / ") || undefined,
          index: idx + 1,
        })),
      });

      // First-party funnel step. Sent straight to the collector, not through
      // trackEvent, so GA4 gets no extra custom event (GTM already sends
      // begin_checkout).
      collect("checkout_start", "/checkout", { value: totalValue });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(track, { timeout: 2000 });
    } else {
      setTimeout(track, 100);
    }
  }, [totalItems]);

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-3 pb-4 pt-1 max-w-5xl">
        <div className="flex flex-col lg:flex-row items-start gap-4 mt-2">
          <div className="w-full lg:w-3/5 order-1">
            <ShippingInformationCard initialSettings={initialSettings} />
          </div>
          <div className="w-full lg:w-2/5 order-2 lg:sticky lg:top-20">
            <OrderSummeryCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutClient;
