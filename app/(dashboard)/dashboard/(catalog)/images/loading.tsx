import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/dashboard/skeletons"

// Images is a flat table (DataTable, 10 rows/page by default), never a card
// grid — GridPageSkeleton (aspect-square cards) used to render here and get
// replaced by table rows of a different height, shifting the page on every
// load. A plain 6-row ListSkeleton (no header) also under-reserved height
// versus the real 10-row table.
export default function Loading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageHeaderSkeleton action={false} />
      <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
      <TableSkeleton rows={10} cols={5} />
    </div>
  )
}
