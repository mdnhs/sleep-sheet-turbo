import React, { Suspense } from "react";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";
import { canAccessTab } from "@/lib/tab-access";
import { UsersPageSkeleton } from "./users-skeleton";

export default async function UsersPage() {
  const user = await getCurrentUser();

  if (!user || !canAccessTab(user, "people.staff")) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersClient />
    </Suspense>
  );
}
