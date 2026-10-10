"use client";

import dynamic from "next/dynamic";
import type { Product } from "@/lib/types";
import { ProductReviewsSkeleton } from "./product-reviews-skeleton";

// `next/dynamic()` has to be called from a Client Component here — calling
// it directly from the async Server Component page triggered a full-page
// "Bail out to client-side rendering" on this Next.js version instead of
// just streaming this one section, so the code-split boundary lives in this
// small client wrapper instead.
const ProductReviews = dynamic(() => import("./product-reviews"), {
  loading: () => <ProductReviewsSkeleton />,
});

export default function ProductReviewsLazy({ product }: { product: Product }) {
  return <ProductReviews product={product} />;
}
