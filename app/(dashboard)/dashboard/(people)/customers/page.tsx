import React, { Suspense } from "react";
import { Metadata } from "next";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { CustomersClient } from "./customers-client";
import { canAccessTab } from "@/lib/tab-access";
import { CustomersPageSkeleton } from "./customers-skeleton";

export const metadata: Metadata = {
  title: "Customers - Dashboard",
  description: "View and manage your customers",
};

export default async function CustomersPage() {
  const user = await getCurrentUser();

  if (!user || !canAccessTab(user, "people.customers")) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<CustomersPageSkeleton />}>
      <CustomersClient />
    </Suspense>
  );
}
