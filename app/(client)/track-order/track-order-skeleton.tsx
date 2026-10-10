import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the search card at the top of TrackOrderContent: same page shell,
// same Card + CardHeader/CardContent padding overrides, and the same block
// heights (64px icon, 32/36px title, 2-line description, h-14 input + button
// that stack on mobile and sit in a row from sm up).
export function TrackOrderSkeleton() {
  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen" aria-hidden="true">
      <div className="container mx-auto px-4 py-8 sm:py-16 max-w-5xl">
        <Card className="bg-card rounded-3xl overflow-hidden mb-8 relative max-w-2xl mx-auto ring-0">
          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto mb-6 mt-2 w-fit">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <div className="flex h-8 justify-center sm:h-9">
              <Skeleton className="h-full w-56 sm:w-64" />
            </div>
            <div className="mx-auto mt-1.5 flex h-10 w-full max-w-md flex-col items-center justify-center gap-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-8 pt-2">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Skeleton className="h-14 flex-1 rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl sm:w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
