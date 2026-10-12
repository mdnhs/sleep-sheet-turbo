"use client"

import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"
import { useSkeletonRows } from "@/hooks/use-skeleton-rows"
import { cn } from "@/lib/utils"

// Mirrors blog-client.tsx: the "Create Post" action row, then the white card
// holding the DataTable — search + Columns toolbar, the 6-column posts table
// and the pagination row.

export function BlogActionsSkeleton() {
  return (
    <div className="flex items-center justify-end gap-4">
      <Skeleton className="h-9 w-31 rounded-full" />
    </div>
  )
}

export function BlogToolbarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex-1 w-full min-w-0">
        <Skeleton className="h-9 w-full max-w-sm rounded-full" />
      </div>
      <div className="flex items-center justify-end gap-2 shrink-0">
        <Skeleton className="h-8 w-22 rounded-full" />
      </div>
    </div>
  )
}

// select, title, author, status, date added, actions
const HEADS = ["w-4", "w-12", "w-14", "w-14", "w-20", "ml-auto w-14"]

function BlogRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <td className="p-3">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="p-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-56 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-24 rounded-md" />
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-6 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-20 rounded-md" />
      </td>
      <td className="p-3">
        <Skeleton className="ml-auto size-8 rounded-lg" />
      </td>
    </tr>
  )
}

/** Rows: what the table showed last time, up to `pageSize` (default `?limit=` 10). */
export function BlogTableSkeleton({ pageSize = 10 }: { pageSize?: number }) {
  const rows = useSkeletonRows("blog.list", pageSize)
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full">
        <thead className="bg-slate-50/70 dark:bg-muted/30">
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {HEADS.map((width, i) => (
              <th key={i} className="h-12 px-3">
                <Skeleton className={cn("h-4 rounded-md", width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <BlogRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BlogPaginationSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-20 rounded-md" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-8 w-17.5 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 py-1">
        <Skeleton className="h-8 w-18 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-12 rounded-lg" />
      </div>
    </div>
  )
}

export function BlogPageSkeleton({ pageSize }: { pageSize?: number }) {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="Blog Posts" description="Create, manage, and publish articles and news" />
      <BlogActionsSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <div className="space-y-4">
          <BlogToolbarSkeleton />
          <BlogTableSkeleton pageSize={pageSize} />
          <BlogPaginationSkeleton />
        </div>
      </div>
    </div>
  )
}
