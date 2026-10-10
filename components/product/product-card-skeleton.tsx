import { Skeleton } from "@/components/ui/skeleton";

// Mirrors ProductCard's box model class-for-class: p-1.5 (sm:p-3) card, aspect-[4/3]
// image + mb-4, px-1 content, a single-line truncated title + mb-1/3,
// the price row (h-12 / sm:30px) + mb-3/4, and the h-10 (sm:h-12) quantity +
// add-to-cart row. Keep in sync with components/product/product-card.tsx.
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white p-1.5 sm:rounded-3xl sm:p-3 dark:bg-slate-900">
      <Skeleton className="mb-2 aspect-[4/3] w-full shrink-0 rounded-xl sm:mb-4 sm:rounded-[20px]" />
      <div className="flex flex-1 flex-col px-0.5 sm:px-1">
        <div className="mb-1 flex flex-1 flex-col justify-center text-sm sm:mb-3 sm:text-[15px]">
          <Skeleton className="h-3.5 w-full rounded-md" />
        </div>
        <div className="mb-1.5 flex h-12 items-center justify-between sm:mb-4 sm:h-[30px]">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mb-1 flex items-center gap-1.5 sm:mb-4 sm:gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl sm:h-12" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl sm:h-12 sm:w-12" />
        </div>
      </div>
    </div>
  );
}

// Same wrapper/item/gutter classes as the Carousel used by FeaturedProduct and
// CategoryCarousel (-ml-3 md:-ml-6 / pl-3 md:pl-6, basis 58% (one card + ~70% of the next) → 1/2 → 1/3 → 1/4,
// py-1.5 md:py-2 around each card) plus the desktop prev/next row (mt-4, h-10).
export function ProductCarouselSkeleton() {
  return (
    <div aria-hidden="true" className="w-full">
      <div className="overflow-hidden">
        <div className="-ml-3 flex md:-ml-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-w-0 shrink-0 grow-0 basis-[58%] pl-3 sm:basis-1/2 md:basis-1/3 md:pl-6 lg:basis-1/4"
            >
              <div className="h-full py-1.5 md:py-2">
                <ProductCardSkeleton />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 hidden items-center justify-end gap-2 md:flex">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}
