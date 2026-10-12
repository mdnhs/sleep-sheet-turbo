"use client";

import { Toaster } from "sonner";

export const OFFER_TOASTER_ID = "checkout-offer";

/**
 * Checkout's own toaster for the "offer claimed" pill. The app-wide Toaster
 * (components/ui/sonner.tsx) is hidden below md, but this one is meant for
 * phones: top centre, over the navbar.
 */
export function OfferToaster() {
  return (
    <Toaster
      id={OFFER_TOASTER_ID}
      position="top-center"
      offset={{ top: 12 }}
      mobileOffset={{ top: 12 }}
      toastOptions={{ unstyled: true }}
    />
  );
}
