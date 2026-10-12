import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/is-authenticated";
import { firstAccessibleTab } from "@/lib/tab-access";
import { settingsNav } from "./settings-nav";

// The old card overview is replaced by the tabs in settings/layout.tsx: open
// the first settings page this user's role can.
export default async function SettingsPage() {
  const user = await getCurrentUser();
  const first = firstAccessibleTab(user, settingsNav.flatMap((group) => group.items));
  redirect(first?.href ?? "/dashboard");
}
