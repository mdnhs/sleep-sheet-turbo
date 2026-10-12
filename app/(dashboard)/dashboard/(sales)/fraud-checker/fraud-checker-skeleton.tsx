import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors FraudCheckerClient (./fraud-checker-client.tsx): centered max-w-4xl
// column, the two-tab bar, the search card, then the FraudResult card in its
// idle state (risk ring + verdict, 3 stat cards, 7 idle courier rows). That
// idle card runs 600-800px tall, so a short placeholder here would collapse
// that height the instant the real component mounted.

export function FraudCheckerTabsSkeleton() {
  return (
    <div className="inline-flex w-fit items-center gap-1 h-9 rounded-4xl bg-muted p-[3px]">
      <Skeleton className="h-full w-28 rounded-xl bg-background" />
      <Skeleton className="h-full w-28 rounded-xl" />
    </div>
  );
}

export function FraudSearchCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 flex-1 rounded-4xl" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-3 w-96 max-w-full rounded-md" />
    </div>
  );
}

/** FraudResult at rest, inside its white card. */
export function FraudResultCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 md:p-8">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skeleton className="h-36 w-36 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="border-t" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[116px] rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FraudCheckerSkeleton() {
  return (
    <div className="font-bengali mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="ফ্রড চেকার" description="পার্সেল পাঠানোর আগে কাস্টমারের কুরিয়ার ডেলিভারি হিস্ট্রি যাচাই করুন।" />
      <div className="flex flex-col gap-2">
        <FraudCheckerTabsSkeleton />
        <div className="space-y-6 pt-2">
          <FraudSearchCardSkeleton />
          <FraudResultCardSkeleton />
        </div>
      </div>
    </div>
  );
}
