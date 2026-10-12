"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors customers-client.tsx: 3 stat cards, then a card holding the
// DataTable (search slot + Columns button, 8 columns, pagination footer).
// The title lives in the navbar (<PageTitle>).

function CustomerStatCardSkeleton({ subtitle = false, className }: { subtitle?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-30 sm:min-h-34", className)}>
      <div className="flex items-center justify-between gap-1.5">
        <Skeleton className="h-3.5 sm:h-4 w-24 sm:w-28 rounded-md" />
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
      </div>
      <div className="mt-2.5 mb-1 space-y-1.5">
        <Skeleton className="h-5 sm:h-7 lg:h-8 w-16 rounded-lg" />
        {subtitle && <Skeleton className="h-2.5 sm:h-3 w-24 rounded-md" />}
      </div>
    </div>
  );
}

/** Total Customers, Made a Purchase (with % line), New This Month. */
export function CustomerStatCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      <CustomerStatCardSkeleton />
      <CustomerStatCardSkeleton subtitle />
      <CustomerStatCardSkeleton className="col-span-2 lg:col-span-1" />
    </div>
  );
}

// Name, Email, Phone, Joined, Orders (badge), Total Spent, Last Order, Actions.
const COLUMN_WIDTHS = ["w-28", "w-40", "w-24", "w-20", "w-8", "w-16", "w-20", "w-32"];

/**
 * DataTable: search slot + Columns button, 8-column table, pagination footer.
 * Rows: what the table showed last time, up to DataTable's page size of 10.
 */
export function CustomersTableSkeleton() {
  const rows = useSkeletonRows("customers.list", 10);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 w-full min-w-0">
          <Skeleton className="h-9 w-full sm:max-w-sm rounded-full" />
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Skeleton className="h-8 w-22 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-240">
          <div className="flex h-12 items-center gap-6 bg-slate-50/70 dark:bg-muted/30 px-3 border-b border-slate-100 dark:border-slate-800">
            {COLUMN_WIDTHS.map((w, i) => (
              <div key={i} className={cn("shrink-0", w)}>
                <Skeleton className="h-4 w-16 max-w-full rounded-md" />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="flex h-14 items-center gap-6 px-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
            >
              {COLUMN_WIDTHS.map((w, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "shrink-0",
                    w,
                    i === 4 ? "h-5 rounded-full" : i === 7 ? "h-8 rounded-full" : "h-3.5 rounded-md"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-22 rounded-md" />
            <Skeleton className="h-8 w-17.5 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-18 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function CustomersTableCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
      <CustomersTableSkeleton />
    </div>
  );
}

export function CustomersPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="Customers" description="Shoppers who registered on your storefront" />
      <CustomerStatCardsSkeleton />
      <CustomersTableCardSkeleton />
    </div>
  );
}
