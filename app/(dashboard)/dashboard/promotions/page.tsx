import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/is-authenticated";
import { canAccessTab } from "@/lib/tab-access";
import PromotionsClientPage from "./promotions-client";
import { PromotionsPageSkeleton } from "./promotions-skeleton";

export const metadata: Metadata = {
  title: "Promotions - Dashboard",
};

export default async function PromotionsPage() {
  const user = await getCurrentUser();
  if (!user || !(user.role === "MODERATOR" || canAccessTab(user, "promotions"))) {
    redirect("/");
  }

  return (
    <Suspense fallback={<PromotionsPageSkeleton />}>
      <PromotionsClientPage />
    </Suspense>
  );
}
