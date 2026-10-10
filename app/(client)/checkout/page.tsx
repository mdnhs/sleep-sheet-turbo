import type { Metadata } from "next";
import React from "react";
import CheckoutClient from "./checkout-client";
import { getPublicSettings } from "@/lib/prefetch-home";

// Private, per-session page — never indexable.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

async function CheckoutPage() {
  const settings = await getPublicSettings().catch(() => null);
  return <CheckoutClient initialSettings={settings} />;
}

export default CheckoutPage;
