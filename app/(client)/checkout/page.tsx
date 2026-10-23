import type { Metadata } from "next";
import { redirect } from "next/navigation";

// Private, per-session page — never indexable.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  redirect("/shop");
}
