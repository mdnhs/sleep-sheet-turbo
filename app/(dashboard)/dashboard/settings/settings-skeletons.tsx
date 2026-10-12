import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SETTINGS_CARD, TextLineSkeleton } from "@/features/settings/components/settings-skeletons";
import { SkeletonRows } from "./skeleton-rows";

// The shared settings skeleton blocks live in features/settings/components/
// settings-skeletons.tsx (the forms there render them while their query
// loads); they're re-exported here for the page skeletons and loading files.
export * from "@/features/settings/components/settings-skeletons";

/* ---------- blocks reused by the clients while their data loads ---------- */

// Name, Created By, Created, Last Used, Status, actions — the API keys DataTable columns.
const API_KEY_COLUMNS = "grid grid-cols-[1.6fr_1.3fr_1fr_1.3fr_0.8fr_0.9fr] items-center gap-4";

/**
 * The API keys DataTable: toolbar, table and pagination. Rows: what the table
 * showed last time, up to DataTable's page size of 10.
 */
export function ApiKeysTableSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 w-full min-w-0" />
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Like the real table, narrow screens see the first columns and the rest is cut off (it scrolls there). */}
        <div className="min-w-[680px]">
          <div className={cn(API_KEY_COLUMNS, "h-10 bg-slate-50/70 dark:bg-muted/30 px-4 border-b border-slate-100 dark:border-slate-800")}>
            {["w-12", "w-20", "w-14", "w-16", "w-12"].map((width, i) => (
              <Skeleton key={i} className={cn("h-3.5 rounded-md", width)} />
            ))}
            <span />
          </div>
          <SkeletonRows listKey="api-keys.list" fallback={10}>
            <div
              className={cn(API_KEY_COLUMNS, "px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 first:border-t-0")}
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <TextLineSkeleton className="w-32" />
              </div>
              <TextLineSkeleton className="w-20" />
              <TextLineSkeleton className="w-28" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <div className="flex justify-end">
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
          </SkeletonRows>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-3">
          <TextLineSkeleton className="w-20" />
          <div className="flex items-center gap-1.5 shrink-0">
            <TextLineSkeleton className="w-20" />
            <Skeleton className="h-8 w-[70px] rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-12 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** The custom role cards while the roles load: as many as last time, else 2. */
export function RoleCardsSkeleton() {
  return (
    <SkeletonRows listKey="roles.cards" fallback={2} min={0}>
      <RoleCardSkeleton />
    </SkeletonRows>
  );
}

/** A role card on the Roles page: name (+ edit/delete), summary line, access badges. */
export function RoleCardSkeleton({ actions = true, badges = 3 }: { actions?: boolean; badges?: number }) {
  return (
    <div aria-hidden className={cn(SETTINGS_CARD, "flex flex-col justify-between space-y-4")}>
      <div>
        <div className="flex justify-between items-start mb-1">
          <Skeleton className="my-0.5 h-6 w-36 rounded-lg" />
          {actions && (
            <div className="flex gap-1">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          )}
        </div>
        <TextLineSkeleton className="w-52 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {Array.from({ length: badges }).map((_, i) => (
          <Skeleton key={i} className={cn("h-6 rounded-full", i % 2 ? "w-24" : "w-20")} />
        ))}
      </div>
    </div>
  );
}
