import React from "react";
import DashBoardClientPage from "./client";
import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";

async function DashBoardPage() {
  const user = await getCurrentUser();
  const hasDashboardAccess =
    user && (user.role === "MODERATOR" || can(user, "dashboard", "read"));

  if (!hasDashboardAccess) {
    redirect("/");
  }

  return <DashBoardClientPage />;
}

export default DashBoardPage;
