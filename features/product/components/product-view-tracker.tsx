"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/traffic-tracker";
import { trackGtmViewItem, splitFullName } from "@/lib/gtm";
import { useCurrent } from "@/features/auth/api/use-current";
import { getCapturedFbc } from "@/lib/meta-fbc";
import type { Product } from "@/lib/types";

/**
 * Pushes the GA4 view_item event for a product. Kept as a tiny client leaf so
 * the product page itself can stay a Server Component.
 *
 * The Meta Pixel ViewContent this used to fire alongside is gone: the GTM web
 * container fires it from this same dataLayer push, and the app firing its
 * own was a second, uncoordinated copy of the event.
 */
export function ProductViewTracker({ product }: { product: Product }) {
  const firedForProduct = useRef<string | null>(null);
  const { data: currentUser } = useCurrent();

  useEffect(() => {
    // Guards against React StrictMode's dev-mode double-invoke of this
    // effect, which otherwise fires view_item twice per page load.
    if (firedForProduct.current === product.id) return;
    firedForProduct.current = product.id;

    const { first_name, last_name } = currentUser?.name ? splitFullName(currentUser.name) : {};
    const fbc = getCapturedFbc();

    const userData = (currentUser || fbc) ? {
      email: currentUser?.email || undefined,
      phone_number: currentUser?.phone || undefined,
      address: (first_name || last_name || currentUser?.address) ? {
        first_name,
        last_name,
        street: currentUser?.address || undefined,
        country: "BD",
      } : undefined,
      fbc,
    } : undefined;

    trackGtmViewItem({
      currency: "BDT",
      value: product.price,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: product.price,
          quantity: 1,
        },
      ],
      user_data: userData,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, currentUser]);

  useEffect(() => {
    const guardKey = `traffic_pv_tracked_${product.id}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(guardKey)) return;
    trackEvent("product_view", `/shop/${product.slug}`, product.name, {
      productId: product.id,
      price: product.price,
    });
    sessionStorage.setItem(guardKey, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
