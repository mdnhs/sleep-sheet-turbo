import React, { Suspense } from "react";
import CategoriesClientPage from "./categories-client";
import { CategoriesPageSkeleton } from "./categories-skeleton";

function CategoriesPage() {
  return (
    <Suspense fallback={<CategoriesPageSkeleton />}>
      <CategoriesClientPage />
    </Suspense>
  );
}

export default CategoriesPage;
