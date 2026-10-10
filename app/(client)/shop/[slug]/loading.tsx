import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/product/product-card-skeleton";
import { ProductReviewsSkeleton } from "@/features/product/components/product-reviews-skeleton";

// Mirrors app/(client)/shop/[slug]/page.tsx block for block: same page shell,
// container padding and gaps, the SwitchImage box heights (h-50 / sm:h-100 /
// lg:h-137.5), the right column (title, rating, countdown, ProductPicker's
// quantity/CTA rows, ProductAccordion), the description card, reviews and the
// related-products strip. Keep the wrapper classes in sync with the page.
export default function ProductLoading() {
  return (
    <div className="bg-[#F4F4F4] dark:bg-gray-800 min-h-screen" aria-hidden="true">
      <div className="container mx-auto px-4 py-2 lg:py-4">
        <div className="hidden lg:flex items-center gap-3 mb-3 h-4">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="relative w-full rounded-[2rem] sm:rounded-[2.5rem] bg-secondary/20 overflow-hidden shadow-sm h-50 sm:h-100 lg:h-137.5">
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute top-0 bottom-0 left-4 sm:left-6 flex flex-col justify-center gap-2 sm:gap-3 py-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] w-14 sm:w-20 md:w-24 rounded-lg sm:rounded-2xl bg-white/40 dark:bg-white/10" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:h-full lg:justify-between pt-0 lg:pt-2">
            <div>
              <div className="mb-1.5 lg:mb-2">
                <Skeleton className="h-7 lg:h-10 w-3/4" />
              </div>
              <div className="mb-2 lg:mb-3 flex h-5 items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="mb-2 lg:mb-4 h-[30px] w-64 max-w-full rounded-full" />

              {/* ProductPicker */}
              <div className="flex flex-col gap-3 lg:gap-4">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Skeleton className="h-12 lg:h-14 w-32 lg:w-36 shrink-0 rounded-full" />
                  <div className="flex flex-1 justify-center">
                    <Skeleton className="h-9 w-28" />
                  </div>
                  <Skeleton className="h-12 w-12 lg:h-14 lg:w-14 shrink-0 rounded-full ml-auto" />
                </div>
                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                  <Skeleton className="h-12 lg:h-14 rounded-full" />
                  <Skeleton className="h-12 lg:h-14 rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  <Skeleton className="h-12 rounded-full" />
                  <Skeleton className="h-12 rounded-full" />
                </div>
              </div>

              {/* ProductAccordion (shipping item, open) */}
              <div className="mt-3">
                <div className="w-full space-y-4">
                  <div className="rounded-2xl p-1 bg-white dark:bg-slate-900">
                    <div className="flex h-11 items-center justify-between px-3">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-1 pb-1">
                      {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-[122px] rounded-xl" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width details */}
        <div className="mt-3 border-t border-border/60 pt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl">
              <div className="mb-4 flex h-7 items-center">
                <Skeleton className="h-5 w-44" />
              </div>
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className={`h-4 ${i === 7 ? "w-3/4" : "w-full"}`} />
                ))}
              </div>
            </section>
          </div>
        </div>

        <div id="product-reviews" className="scroll-mt-10">
          <ProductReviewsSkeleton />
        </div>
      </div>

      <section className="mt-3 pt-3 bg-white dark:bg-slate-900 border-t border-border/50">
        <div className="container mx-auto px-4 mb-3">
          <div className="mx-auto flex h-9 md:h-10 w-64 items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
        <div className="container mx-auto px-4 pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
