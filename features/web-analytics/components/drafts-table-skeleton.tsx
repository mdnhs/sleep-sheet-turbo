"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";
import { DRAFTS_PAGE_SIZE } from "../api/use-web-analytics";

/**
 * The leads table: header row, then customer / time / address / cart / value
 * rows. Without `rows` it draws as many rows as IncompleteCheckouts showed
 * last time (useRememberRows there), else one page.
 */
export function DraftsTableSkeleton({ rows }: { rows?: number }) {
  const remembered = useSkeletonRows("analytics.drafts", DRAFTS_PAGE_SIZE);
  const count = rows ?? remembered;
  return (
    <div aria-hidden className="overflow-x-auto">
      <div className="min-w-140">
        <div className="flex h-12 items-center gap-4 border-b px-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-3.5 flex-1 rounded-md", i === 4 && "max-w-12 ml-auto")} />
          ))}
        </div>
        {Array.from({ length: count }).map((_, r) => (
          <div key={r} className="flex items-start gap-4 border-b p-3 last:border-0">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
              <div className="mt-2 flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="size-7 rounded-md" />
                ))}
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded" />
              <Skeleton className="h-3 w-full rounded-md" />
            </div>
            <Skeleton className="h-3 flex-1 rounded-md" />
            <Skeleton className="h-3 flex-1 rounded-md" />
            <Skeleton className="h-4 max-w-12 flex-1 ml-auto rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
