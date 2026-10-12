import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"

// Mirrors PosClientPage (./pos-client.tsx): a full-height row with the
// product browser (search + 3 filter selects, then a 2/3-column ProductCard
// grid) and, on lg+, the 400px "Current Sale" cart panel in its empty state.
// Below lg the cart is the fixed bottom bar instead.

export function PosFilterBarSkeleton() {
  return (
    <div className="pb-2 sm:pb-4 border-b space-y-1.5 sm:space-y-3 shrink-0">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        <Skeleton className="h-9 flex-1 min-w-[140px] rounded-full" />
        <Skeleton className="h-8 w-[130px] sm:w-[170px] rounded-full" />
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-8 w-full sm:w-[140px] rounded-full" />
          <Skeleton className="h-8 w-full sm:w-[170px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** One ProductCard: 4:3 image, name, price, quantity stepper, "Add to Cart" button. */
export function PosProductCardSkeleton() {
  return (
    <div className="w-full h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 p-1.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 overflow-hidden">
      <Skeleton className="w-full aspect-[4/3] rounded-[20px] mb-4 shrink-0" />
      <div className="flex flex-col px-1 flex-1">
        <div className="flex-1 space-y-1.5 mb-2 sm:mb-3">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <Skeleton className="h-6 sm:h-7 w-20 sm:w-24 rounded-md mb-3 sm:mb-4" />
        <Skeleton className="h-10 sm:h-12 w-full rounded-xl mb-3 sm:mb-4" />
      </div>
      <div className="px-1 shrink-0">
        <Skeleton className="h-10 sm:h-12 w-full rounded-[14px]" />
      </div>
    </div>
  )
}

/** The product grid while the products query loads. */
export function PosProductGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <PosProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Desktop cart panel: "Current Sale" header and the empty-cart message. */
export function PosCartPanelSkeleton() {
  return (
    <div className="hidden lg:flex w-[400px] flex-col rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none shrink-0">
      <div className="p-4 border-b flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-5 w-28 rounded-md" />
      </div>
      <div className="flex-1 p-4 flex flex-col items-center justify-center gap-2">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3 w-44 rounded-md" />
      </div>
    </div>
  )
}

/** Mobile sticky cart bar (item count + total, "View Cart" button). */
export function PosMobileCartBarSkeleton() {
  return (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between md:left-64">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <Skeleton className="h-10 w-36 rounded-full" />
    </div>
  )
}

export function PosSkeleton() {
  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] p-2 sm:p-4 md:p-6 gap-3 sm:gap-6 relative">
      <PageTitle title="Point of Sale" />
      <div className="flex-1 flex flex-col rounded-3xl bg-white dark:bg-card p-1.5 sm:p-6 border-none shadow-none overflow-hidden pb-16 lg:pb-0">
        <PosFilterBarSkeleton />
        <div className="flex-1 overflow-hidden pt-2 sm:pt-4">
          <PosProductGridSkeleton />
        </div>
      </div>
      <PosCartPanelSkeleton />
      <PosMobileCartBarSkeleton />
    </div>
  )
}
