import React from "react";
import UpdateProductClient from "./update-product-client";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { canAccessTab } from "@/lib/tab-access";

async function UpdateProduct() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR" && !(can(user, "products", "write") && canAccessTab(user, "catalog.products")))) {
    redirect("/");
  }

  return <UpdateProductClient />;
}

export default UpdateProduct;
