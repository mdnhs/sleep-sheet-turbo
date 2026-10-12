import { Suspense } from "react";
import { Metadata } from "next";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { ActivityClient } from "./activity-client";
import { can } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Activity Log - Dashboard",
  description: "Audit trail of all dashboard user actions",
};

function ActivitySkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <div className="grid gap-4 grid-cols-2">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

export default async function ActivityPage() {
  const user = await getCurrentUser();

  if (!user || !can(user, "activity", "read")) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <ActivityClient />
    </Suspense>
  );
}
