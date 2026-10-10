import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the confirmation card in OrderSuccessContent: same shell and Card
// classes, 64px check icon, 32/36px title, 2-line description, phone strip,
// h-12 WhatsApp button, h-11 button pair (stacked on mobile, row from sm up)
// and the footer link.
export function OrderSuccessSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-16" aria-hidden="true">
      <Card className="bg-background border border-border/40 rounded-3xl shadow-xl overflow-hidden relative">
        <CardContent className="flex flex-col items-center justify-center text-center p-6 sm:p-10 pt-10">
          <Skeleton className="mb-6 h-16 w-16 rounded-full" />
          <Skeleton className="mb-2 h-8 w-56 sm:h-9" />
          <div className="mb-6 flex w-full max-w-md flex-col items-center gap-1.5">
            <Skeleton className="h-5 w-full sm:h-6" />
            <Skeleton className="h-5 w-2/3 sm:h-6" />
          </div>
          <Skeleton className="mb-6 h-[67px] w-full rounded-2xl" />
          <Skeleton className="mb-4 h-12 w-full rounded-full" />
          <div className="mb-6 flex w-full flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 flex-1 rounded-full" />
          </div>
          <div className="flex w-full justify-center border-t border-border/40 pt-6">
            <Skeleton className="h-5 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
