import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";

/** Toolbar plus a grid of square tiles, matching media-client.tsx. */
export function MediaGridSkeleton({ tiles = 12 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="space-y-2 rounded-2xl border p-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function MediaPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="Media" description="Files stored in Cloudflare R2" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
      <MediaGridSkeleton />
    </div>
  );
}
