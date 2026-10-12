import React, { Suspense } from "react";
import ProductsClientPage from "./client";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

function ProductsSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

async function ProductPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR" && !can(user, "products", "read"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsClientPage />
    </Suspense>
  );
}

export default ProductPage;
