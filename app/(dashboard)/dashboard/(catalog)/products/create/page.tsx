import React from "react";

import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import AddProductClient from "./create-product-client";
import { CreateProductPageSkeleton } from "./create-product-skeleton";
import { can } from "@/lib/permissions";
import { canAccessTab } from "@/lib/tab-access";

async function AddProduct() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR" && !(can(user, "products", "write") && canAccessTab(user, "catalog.products")))) {
    redirect("/");
  }

  return (
    <React.Suspense fallback={<CreateProductPageSkeleton />}>
      <AddProductClient />
    </React.Suspense>
  );
}

export default AddProduct;
