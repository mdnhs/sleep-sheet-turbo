import React from "react";
import DashBoardClientPage from "./client";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { canAccessTab } from "@/lib/tab-access";

async function DashBoardPage() {
  const user = await getCurrentUser();
  const hasDashboardAccess =
    user && (user.role === "MODERATOR" || canAccessTab(user, "dashboard"));

  if (!hasDashboardAccess) {
    redirect("/");
  }

  return <DashBoardClientPage />;
}

export default DashBoardPage;
