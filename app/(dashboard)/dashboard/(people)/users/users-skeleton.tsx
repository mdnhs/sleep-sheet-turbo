"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors users-client.tsx (Staff): a right-aligned "Add User" button, then
// a card with the search input and a DataTable (Columns button, 5 columns,
// pagination footer). The title lives in the navbar (<PageTitle>).

export function StaffActionsSkeleton() {
  return (
    <div className="flex items-center justify-end gap-4">
      <Skeleton className="h-9 w-30 rounded-full" />
    </div>
  );
}

// Name, Email, System Role (badge), Assigned Custom Role (select), Actions.
const COLUMN_WIDTHS = ["w-28", "w-44", "w-20", "w-45", "w-32"];

/**
 * DataTable: (empty search slot) Columns button, 5-column table, pagination
 * footer. Rows: what the table showed last time, up to DataTable's page size of 10.
 */
export function StaffTableSkeleton() {
  const rows = useSkeletonRows("users.list", 10);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 w-full min-w-0" />
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Skeleton className="h-8 w-22 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-200">
          <div className="flex h-12 items-center gap-6 bg-slate-50/70 dark:bg-muted/30 px-3 border-b border-slate-100 dark:border-slate-800">
            {COLUMN_WIDTHS.map((w, i) => (
              <div key={i} className={cn("shrink-0", w)}>
                <Skeleton className="h-4 w-20 max-w-full rounded-md" />
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
                    i === 2 ? "h-5 rounded-full" : i >= 3 ? "h-8 rounded-full" : "h-3.5 rounded-md"
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
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** The card: search input above the staff DataTable. */
export function StaffTableCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <Skeleton className="h-9 w-full max-w-sm rounded-full" />
      <StaffTableSkeleton />
    </div>
  );
}

export function UsersPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="Staff" description="Manage team members and assign custom roles" />
      <StaffActionsSkeleton />
      <StaffTableCardSkeleton />
    </div>
  );
}
