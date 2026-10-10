import { redirect } from "next/navigation";

// The old card overview is replaced by the tabs in settings/layout.tsx.
export default function SettingsPage() {
  redirect("/dashboard/settings/currency");
}
