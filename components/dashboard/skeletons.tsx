import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Each dashboard page has its own skeleton next to its route
// (e.g. app/(dashboard)/dashboard/(sales)/orders/orders-skeleton.tsx) that
// mirrors that page block by block. Only small generic pieces live here.

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center gap-4 bg-slate-50/70 dark:bg-muted/30 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-800/60"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-5 flex-1 rounded-md", c === 0 && "max-w-10 h-10")} />
          ))}
        </div>
      ))}
    </div>
  )
}
