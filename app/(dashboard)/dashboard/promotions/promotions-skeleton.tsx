"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrent } from "@/features/auth/api/use-current";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { isAllowed } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Mirrors promotions-client.tsx: the "New promotion" action row (write access
// only — shown until the user is known), then the white card holding
// PromotionsTable (plain shadcn <Table>, 8 columns).

export function PromotionsActionsSkeleton() {
  // Same check as the client page; shown while the user is unknown (server
  // render, first client render, query still loading).
  const mounted = useHasMounted();
  const { data: user } = useCurrent();
  if (mounted && user !== undefined && !isAllowed(user ?? null, "promotions", "write", ["MODERATOR"])) {
    return null;
  }
  return (
    <div className="flex items-center justify-end gap-4">
      <Skeleton className="h-9 w-37 rounded-full" />
    </div>
  );
}

// promotion, payment methods, zones, min. order, dates, status, on, actions
const HEADS = ["w-20", "w-28", "w-12", "w-20", "w-12", "w-14", "w-6", "ml-auto w-14"];

function ChipsSkeleton({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {widths.map((width, i) => (
        <Skeleton key={i} className={cn("h-5 rounded-4xl", width)} />
      ))}
    </div>
  );
}

function PromotionRowSkeleton() {
  return (
    <tr className="border-b last:border-0">
      <td className="p-3 max-w-xs">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-3 w-56 max-w-full rounded-md" />
        </div>
      </td>
      <td className="p-3">
        <ChipsSkeleton widths={["w-24", "w-14"]} />
      </td>
      <td className="p-3">
        <ChipsSkeleton widths={["w-20"]} />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-16 rounded-md" />
      </td>
      <td className="p-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-36 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
      </td>
      <td className="p-3">
        <Skeleton className="h-5 w-12 rounded-4xl" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4.5 w-8 rounded-full" />
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

/**
 * The table isn't paged (every promotion renders), so rows are what it showed
 * last time, capped at 4.
 */
export function PromotionsTableSkeleton() {
  const rows = useSkeletonRows("promotions.list", 4);
  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {HEADS.map((width, i) => (
              <th key={i} className="h-12 px-3">
                <Skeleton className={cn("h-4 rounded-md", width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <PromotionRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PromotionsPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle
        title="Promotions"
        description="Free delivery offers by payment method — shown on /offer and applied at checkout"
      />
      <PromotionsActionsSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none">
        <PromotionsTableSkeleton />
      </div>
    </div>
  );
}
