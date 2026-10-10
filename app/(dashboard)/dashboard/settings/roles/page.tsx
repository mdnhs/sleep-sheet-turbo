import { getCurrentUser } from "@/lib/is-authenticated";
import { redirect } from "next/navigation";
import { RolesClient } from "./roles-client";
import { can } from "@/lib/permissions";

export default async function RolesPage() {
  const user = await getCurrentUser();

  if (!user || !can(user, "roles", "read")) {
    redirect("/dashboard");
  }

  return <RolesClient />;
}
