import { FraudCheckerSkeleton } from "./page"

// Reuses the page's own skeleton (centered search form, not a table) so the
// route-level fallback and the page's inline Suspense fallback match — the
// generic TablePageSkeleton that used to render here had a completely
// different, full-width table shape.
export default function Loading() {
  return <FraudCheckerSkeleton />
}
