"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors expenses-client.tsx: right-aligned Add Category / Log Expense
// buttons, 3 SummaryCards, and the Expense History card (pill date filters +
// category select above the table). The title lives in the navbar.

/** "Add Category" (outline) + "Log Expense" pill buttons. */
export function ExpensesActionsSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
      <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
        <Skeleton className="h-9 rounded-full flex-1 sm:flex-none sm:w-34" />
        <Skeleton className="h-9 rounded-full flex-1 sm:flex-none sm:w-33" />
      </div>
    </div>
  );
}

function SummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-white dark:bg-card border-none p-4 sm:p-6 shadow-none flex flex-col justify-between min-h-30 sm:min-h-34", className)}>
      <div className="flex items-center justify-between gap-1.5">
        <Skeleton className="h-3.5 sm:h-4 w-24 sm:w-32 rounded-md" />
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
      </div>
      <div className="mt-2.5 mb-1 space-y-1.5">
        <Skeleton className="h-5 sm:h-7 lg:h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-2.5 sm:h-3 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function ExpenseSummaryCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      <SummaryCardSkeleton />
      <SummaryCardSkeleton />
      <SummaryCardSkeleton className="col-span-2 lg:col-span-1" />
    </div>
  );
}

/**
 * Date, Category, Note, Amount, Actions (2 icon buttons). The history isn't
 * paged (the API returns up to 500), so rows are what it showed last time,
 * capped at 6 — about a screenful.
 */
export function ExpenseTableSkeleton() {
  const rows = useSkeletonRows("expenses.list", 6);
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex h-12 items-center gap-4 bg-slate-50/70 dark:bg-muted/30 px-3">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 flex-1 max-w-16 rounded-md" />
        <Skeleton className="h-4 w-16 ml-auto rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex h-14 items-center gap-4 border-t border-slate-100 dark:border-slate-800/60 px-3"
        >
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3.5 flex-1 max-w-48 rounded-md" />
          <Skeleton className="h-3.5 w-16 ml-auto rounded-md" />
          <div className="flex w-16 items-center justify-end gap-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Expense History" card: heading, 4 date pills + category select, then the table. */
export function ExpenseHistorySkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-6 w-36 rounded-xl" />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* All Time, Today, Last 7 Days, This Month */}
            {["w-18", "w-15", "w-23", "w-22"].map((w, i) => (
              <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
            ))}
          </div>
          <Skeleton className="h-8 w-full sm:w-48 rounded-full" />
        </div>
      </div>
      <ExpenseTableSkeleton />
    </div>
  );
}

export function ExpensesPageSkeleton() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageTitle title="Expenses" description="Log and manage your business expenses" />
      <ExpensesActionsSkeleton />
      <ExpenseSummaryCardsSkeleton />
      <ExpenseHistorySkeleton />
    </div>
  );
}
