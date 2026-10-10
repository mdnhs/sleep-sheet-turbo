import { Suspense } from "react";
import { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { FraudCheckerClient } from "./fraud-checker-client";
import { can } from "@/lib/permissions";
import { getMyPlan } from "@/lib/bdcourier";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "ফ্রড চেকার - Dashboard",
  description: "পার্সেল পাঠানোর আগে কাস্টমারের কুরিয়ার ডেলিভারি হিস্ট্রি যাচাই করুন",
};

// Mirrors FraudCheckerClient's real layout (centered max-w-4xl column,
// header, two-tab bar, search card, then the FraudResult card in its idle
// state) instead of a generic block — also reused as-is by loading.tsx so
// the route-level fallback and this inline Suspense fallback never disagree
// on shape. The idle FraudResult card (risk ring + stat row + 7 idle
// courier rows) runs 600-800px tall; a short placeholder here used to
// collapse that much height the instant the real component mounted,
// reading as a hard jump rather than a fade.
export function FraudCheckerSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full rounded-xl" />
      </div>
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-full shrink-0" />
        </div>
        <Skeleton className="h-3 w-72 max-w-full rounded-md" />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skeleton className="h-36 w-36 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3 w-full">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="border-t" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-56 rounded-md" />
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function FraudCheckerPage() {
  const user = await getCurrentUser();

  if (!user || !can(user, "orders", "read")) {
    redirect("/dashboard");
  }

  // Server-render the plan so the "আমার প্ল্যান" tab paints filled in instead
  // of flashing a skeleton. Calls the lib directly — fetching our own API
  // route from here would be a pointless HTTP round trip.
  //
  // Only the plan: a fraud check is billed per call, so it must stay on the
  // admin's click and never fire from a page render.
  //
  // prefetchQuery never throws, and dehydrate() drops failed queries, so a
  // missing API key or a slow BD Courier just leaves the client to fetch and
  // show its own error (PlanCard has both states).
  //
  // The timeout is deliberately tight: this await sits in front of the page's
  // own render, so it is pure TTFB for a tab that isn't even the default one.
  // Better to give up quickly and let the client fill it in than to hold the
  // Check tab hostage to BD Courier having a slow day.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["fraud-check-plan"],
    queryFn: () => getMyPlan(2_500),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<FraudCheckerSkeleton />}>
        <FraudCheckerClient />
      </Suspense>
    </HydrationBoundary>
  );
}
