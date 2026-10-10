import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata — this
// layout carries it instead. Per-order/per-lookup page, never indexable.
export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
