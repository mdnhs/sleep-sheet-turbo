import { FormSkeleton } from "@/components/dashboard/skeletons"

// This only fills the `{children}` slot inside SettingsShell, which already
// renders the real "Settings" h1, left nav, and nested tabs outside this
// Suspense boundary — a full ListPageSkeleton (its own page wrapper +
// duplicate header + centered pill list) doesn't belong here and doesn't
// match any settings subpage's actual form/table content.
export default function Loading() {
  return <FormSkeleton />
}
