import React, { Suspense } from "react";
import CategoriesClientPage from "./categories-client";
import { Skeleton } from "@/components/ui/skeleton";

function CategoriesSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

function CategoriesPage() {
  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesClientPage />
    </Suspense>
  );
}

export default CategoriesPage;
