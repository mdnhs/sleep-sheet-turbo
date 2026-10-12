"use client";

import * as React from "react";

// How many rows a list showed last time, so its loading skeleton can draw the
// same number instead of a guess. Kept in memory only: it survives client
// navigation, and a full reload falls back to the page size. Never read on
// the server (the server snapshot is the fallback), so SSR and hydration
// always agree and no user's count leaks into another's render.
const lastRows = new Map<string, number>();

const subscribeNothing = () => () => {};

/** Call from the real list with the number of rows it renders. */
export function useRememberRows(key: string, count: number | undefined) {
  React.useEffect(() => {
    if (count !== undefined) lastRows.set(key, count);
  }, [key, count]);
}

/**
 * Rows for a list skeleton: what the list showed last time, else `fallback`
 * (normally the page size). At most `fallback`, and at least `min`: 1 by
 * default since an empty table still shows its empty-state row; pass 0 for
 * lists that render nothing when empty (e.g. cards).
 */
export function useSkeletonRows(key: string, fallback: number, min = 1): number {
  const remembered = React.useSyncExternalStore(
    subscribeNothing,
    () => lastRows.get(key),
    () => undefined,
  );
  if (remembered === undefined) return fallback;
  return Math.min(Math.max(remembered, min), fallback);
}
