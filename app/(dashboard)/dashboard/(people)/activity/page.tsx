import { Suspense } from "react";
import { Metadata } from "next";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { ActivityClient } from "./activity-client";
import { canAccessTab } from "@/lib/tab-access";
import { ActivityPageSkeleton } from "./activity-skeleton";

export const metadata: Metadata = {
  title: "Activity Log - Dashboard",
  description: "Audit trail of all dashboard user actions",
};

export default async function ActivityPage() {
  const user = await getCurrentUser();

  if (!user || !canAccessTab(user, "people.activity")) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<ActivityPageSkeleton />}>
      <ActivityClient />
    </Suspense>
  );
}
