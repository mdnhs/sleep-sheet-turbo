"use client";

import type { ReactNode } from "react";
import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrent } from "@/features/auth/api/use-current";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Mirrors OrdersPageContent (./page.tsx): Steadfast balance pill, the 7
// status tabs, then the white card with the search/filter toolbar and the
// orders DataTable (10 visible columns by default) with its pagination row.

/** Approximate label widths of the 7 status tabs: All, Today Confirmed, Pending, Confirmed, Delivered, Cancelled, Returned. */
const STATUS_TAB_WIDTHS = ["w-16", "w-36", "w-24", "w-28", "w-28", "w-28", "w-28"];

/**
 * Default visible columns: select, Type, Customer, Date, Total, Bought Price,
 * Charge, Profit, Status, Actions (Order #, Facebook Page and Tracking # start hidden).
 */
const ORDER_COLUMNS: { head: string; cell: ReactNode }[] = [
  { head: "w-4", cell: <Skeleton className="size-4 rounded" /> },
  { head: "w-10", cell: <Skeleton className="h-5 w-16 rounded-full" /> },
  {
    head: "w-20",
    cell: (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </div>
    ),
  },
  {
    head: "w-10",
    cell: (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-3 w-12 rounded-md" />
      </div>
    ),
  },
  { head: "w-12", cell: <Skeleton className="h-4 w-14 rounded-md" /> },
  { head: "w-20", cell: <Skeleton className="h-4 w-14 rounded-md" /> },
  { head: "w-14", cell: <Skeleton className="h-4 w-10 rounded-md" /> },
  { head: "w-12", cell: <Skeleton className="h-4 w-12 rounded-md" /> },
  { head: "w-12", cell: <Skeleton className="h-5 w-20 rounded-full" /> },
  {
    head: "ml-auto w-14",
    cell: (
      <div className="flex justify-end gap-1.5">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
      </div>
    ),
  },
];

/** Orders page size (OrdersPageContent's initial pagination). */
const ORDERS_PAGE_SIZE = 25;

/**
 * Same gate as OrdersPageContent: ADMIN/MODERATOR, else the granular order
 * permission. Shown while the user is unknown (server render, first client
 * render, query still loading) so the skeleton keeps its default shape.
 */
function useOrdersPermission(action: "write" | "balance"): boolean {
  const mounted = useHasMounted();
  const { data: user } = useCurrent();
  if (!mounted || user === undefined) return true;
  return user?.role === "ADMIN" || user?.role === "MODERATOR" || can(user ?? null, "orders", action);
}

export function OrdersBalanceSkeleton() {
  const show = useOrdersPermission("balance");
  if (!show) return null;
  return (
    <div className="flex flex-col items-end sm:flex-row sm:items-center justify-end gap-3">
      <Skeleton className="h-9 w-[150px] sm:h-10 sm:w-[180px] lg:h-12 rounded-full" />
    </div>
  );
}

export function OrdersTabsSkeleton() {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
        <div className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full">
          {STATUS_TAB_WIDTHS.map((width, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-8 shrink-0 rounded-full",
                width,
                i === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-300/60 dark:bg-muted",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrdersToolbarSkeleton() {
  // "Refresh Steadfast" (mobile icon + desktop button) needs orders write.
  const canWrite = useOrdersPermission("write");
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 sm:contents">
        <Skeleton className="h-9 flex-1 min-w-[140px] sm:max-w-sm rounded-full" />
        {canWrite && <Skeleton className="sm:hidden size-8 shrink-0 rounded-full" />}
      </div>
      <div className="flex items-center justify-end gap-2 flex-wrap sm:contents">
        <Skeleton className="h-9 flex-1 sm:flex-none sm:w-36 rounded-full" />
        {canWrite && <Skeleton className="hidden sm:block h-8 w-40 shrink-0 rounded-full" />}
        <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

/**
 * The orders DataTable while its query loads: bordered table + pagination row.
 * Draws as many rows as the list showed last time (up to `pageSize`).
 */
export function OrdersTableSkeleton({ pageSize = ORDERS_PAGE_SIZE }: { pageSize?: number }) {
  const rows = useSkeletonRows("orders.list", pageSize);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[860px]">
          <div className="flex h-12 items-center gap-6 bg-slate-50/70 dark:bg-muted/30 border-b border-slate-100 dark:border-slate-800 px-3">
            {ORDER_COLUMNS.map((col, i) => (
              <div key={i} className={cn("flex", i === ORDER_COLUMNS.length - 1 ? "ml-auto" : "flex-1", i === 0 && "flex-none")}>
                <Skeleton className={cn("h-4 rounded-md", col.head)} />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="flex h-16 items-center gap-6 border-b border-slate-100 dark:border-slate-800/60 px-3 last:border-b-0"
            >
              {ORDER_COLUMNS.map((col, i) => (
                <div key={i} className={cn(i === ORDER_COLUMNS.length - 1 ? "ml-auto" : "flex-1", i === 0 && "flex-none")}>
                  {col.cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-8 w-[70px] rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-[74px] rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-8 w-[52px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function OrdersPageSkeleton() {
  return (
    <div className="flex-1 space-y-1.5 sm:space-y-4 p-1.5 sm:p-4 md:p-8 pt-1.5 sm:pt-4 md:pt-6">
      <PageTitle title="Order Management" />
      <OrdersBalanceSkeleton />
      <OrdersTabsSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-1.5 sm:p-6 border-none shadow-none space-y-1.5 sm:space-y-4">
        <OrdersToolbarSkeleton />
        <OrdersTableSkeleton />
      </div>
    </div>
  );
}
