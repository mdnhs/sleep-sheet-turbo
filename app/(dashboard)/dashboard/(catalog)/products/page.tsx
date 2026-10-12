import React, { Suspense } from "react";
import ProductsClientPage from "./client";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { canAccessTab } from "@/lib/tab-access";
import { ProductsRouteSkeleton } from "./products-view-skeleton";

async function ProductPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR" && !canAccessTab(user, "catalog.products"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<ProductsRouteSkeleton />}>
      <ProductsClientPage />
    </Suspense>
  );
}

export default ProductPage;
