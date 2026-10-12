import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { RolesClient } from "./roles-client";
import { canAccessTab } from "@/lib/tab-access";

export default async function RolesPage() {
  const user = await getCurrentUser();

  if (!user || !canAccessTab(user, "settings.roles")) {
    redirect("/dashboard");
  }

  return <RolesClient />;
}
