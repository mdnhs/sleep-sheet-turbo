import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors ProductReviews: mt-20 wrapper, header row (text-2xl title + outline
// button), the lg:[1fr_2fr] grid with gap-12 lg:gap-16 / items-start, the score
// block (text-7xl = 72px, then a text-sm line), five 16px bar rows, and the
// divided review list (py-6 rows with a 40px avatar). Keep in sync with
// features/product/components/product-reviews.tsx.
export function ProductReviewsSkeleton() {
  return (
    <div className="w-full mt-20" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-16 items-start">
        <div className="flex flex-col sm:flex-row lg:flex-col gap-8 items-center sm:items-stretch lg:items-stretch">
          <div className="flex flex-col justify-center">
            <Skeleton className="h-[72px] w-36 rounded-lg" />
            <Skeleton className="mt-2 h-5 w-32 rounded" />
          </div>
          <div className="flex-1 w-full max-w-[200px] flex flex-col gap-2 justify-center">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex h-4 items-center gap-3">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-1.5 flex-1 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col divide-y divide-border/60">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 py-6 first:pt-0">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex h-5 items-center justify-between gap-x-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="mb-2 h-3.5 w-[86px]" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductReviewsSkeleton;
