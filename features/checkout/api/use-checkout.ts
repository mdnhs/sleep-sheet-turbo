import { client } from "@/lib/rpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaymentInformationFormValues,
  ShippingInformationFormValues
} from "../schema";
import { useCartStore } from "@/features/cart/state/use-cart-store";
import {
  getOrCreateCheckoutIdempotencyKey,
  clearCheckoutIdempotencyKey,
} from "@/lib/checkout-idempotency";
import { getCapturedFbc } from "@/lib/meta-fbc";
import { getCapturedLandingSignals } from "@/lib/traffic-source";
import { getAnalyticsIds } from "@/features/web-analytics/lib/collector";
import { triggerHaptic } from "@/lib/haptics";

interface useCheckoutProps {
  paymentInfo: Partial<PaymentInformationFormValues>;
  paymentMethod: "cod" | "card" | "bkash";
  shippingInfo: ShippingInformationFormValues;
}

export const UseCheckout = () => {
  const guestItems = useCartStore((state) => state.guestItems);
  const clearCart = useCartStore((state) => state.clearCart);
  const clearGuestCart = useCartStore((state) => state.clearGuestCart);

  return useMutation({
    mutationFn: async ({
      paymentInfo,
      paymentMethod,
      shippingInfo,
    }: useCheckoutProps) => {
      const landing = getCapturedLandingSignals();
      const analyticsIds = getAnalyticsIds();
      const payload = {
        shippingInfo,
        paymentInfo: {
          paymentMethod,
          cardNumber: paymentInfo?.cardNumber,
          expirationDate: paymentInfo?.expirationDate,
          cvv: paymentInfo?.cvv,
          nameOnCard: paymentInfo?.nameOnCard,
        },
        guestItems: guestItems.length > 0 ? guestItems : undefined,
        // Same key for every submit of this cart, so a duplicate submit returns
        // the existing order instead of creating a second one.
        idempotencyKey: getOrCreateCheckoutIdempotencyKey(),
        // Meta click-id, captured client-side on landing (see meta-fbc.ts) —
        // sent explicitly so the server-side Purchase CAPI call doesn't have
        // to depend on the Pixel's own _fbc cookie having been set in time.
        fbc: getCapturedFbc(),
        // Google's click id + UTM tags + referrer, captured the same way
        // (see lib/traffic-source.ts) — the server turns this into the
        // "Facebook Ad / YouTube Ad / Google Ad / Direct" label the orders
        // dashboard shows.
        gclid: landing?.gclid,
        utmSource: landing?.utmSource,
        utmMedium: landing?.utmMedium,
        utmCampaign: landing?.utmCampaign,
        landingReferrer: landing?.referrer,
        analyticsVisitorId: analyticsIds?.visitorId,
        analyticsSessionId: analyticsIds?.sessionId,
      };

      const response = await client.api.checkout.$post({ json: payload });

      if (!response.ok) {
        let errorMsg = "Failed to checkout";
        try {
          const errorData = (await response.json()) as { message?: string; error?: string };
          if (errorData?.message) {
            errorMsg = errorData.message;
          } else if (typeof errorData?.error === "string") {
            errorMsg = errorData.error;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }

      return response.json();
    },

    onSuccess: (data, variables) => {
      // bKash: the order is only reserved. Hand the customer over to bKash's
      // payment page and leave the cart and idempotency key alone — they are
      // retired once the payment is confirmed (order-success page), so a
      // failed or cancelled payment can be retried from the same cart.
      const bkashURL = (data as { bkashURL?: string }).bkashURL;
      if (bkashURL) {
        toast.loading("Redirecting to bKash...");
        window.location.href = bkashURL;
        return;
      }

      // Capture cart items snapshot before clearing to populate actual product names & variants in GTM
      const cartSnapshot = [
        ...useCartStore.getState().items,
        ...useCartStore.getState().guestItems,
      ];
      toast.success("Order placed successfully!");
      triggerHaptic("success");
      clearCart();
      clearGuestCart();
      try { localStorage.removeItem("guest-cart"); } catch { /* ignore */ }
      // Order is placed — retire this key so the customer's next checkout
      // starts a fresh idempotency window.
      clearCheckoutIdempotencyKey();

      const orderId =
        (data as { orderId?: string }).orderId ??
        (data as { order?: { id?: string } }).order?.id;

      if (orderId) {
        try {
          const orderObj = (data as { order?: unknown }).order;
          if (orderObj) {
            sessionStorage.setItem(`ss_order_data_${orderId}`, JSON.stringify(orderObj));
          }
        } catch {
          /* ignore storage error */
        }
        window.location.href = `/order-success?orderId=${orderId}&phone=${encodeURIComponent(variables.shippingInfo.phone)}`;
      }
    },

    onError: (error: Error) => {
      triggerHaptic("error");
      toast.error(error.message);
    },
  });
};
