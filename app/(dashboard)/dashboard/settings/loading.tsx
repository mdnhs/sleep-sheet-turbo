import { FieldSkeleton, SaveRowSkeleton, SettingsCardSkeleton } from "./settings-skeletons";

// Fallback only: every settings page has its own loading.tsx that mirrors its
// layout (see settings-page-skeletons.tsx), so this shows just for routes
// without one, e.g. /dashboard/settings itself while it redirects. It fills
// the `{children}` slot inside SettingsShell, which already renders the left
// nav and nested tabs outside this Suspense boundary, so it's a plain content
// card: no title (pages put theirs in the navbar via <PageTitle>) and no nav.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SettingsCardSkeleton description={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton className="md:col-span-2" control="textarea" />
        </div>
      </SettingsCardSkeleton>
      <SaveRowSkeleton />
    </div>
  );
}
