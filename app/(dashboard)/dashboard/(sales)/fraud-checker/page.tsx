import { Suspense } from "react";
import { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { FraudCheckerClient } from "./fraud-checker-client";
import { canAccessTab } from "@/lib/tab-access";
import { getMyPlan } from "@/lib/bdcourier";
import { FraudCheckerSkeleton } from "./fraud-checker-skeleton";

export const metadata: Metadata = {
  title: "ফ্রড চেকার - Dashboard",
  description: "পার্সেল পাঠানোর আগে কাস্টমারের কুরিয়ার ডেলিভারি হিস্ট্রি যাচাই করুন",
};

export default async function FraudCheckerPage() {
  const user = await getCurrentUser();

  if (!user || !canAccessTab(user, "sales.fraud-checker")) {
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
