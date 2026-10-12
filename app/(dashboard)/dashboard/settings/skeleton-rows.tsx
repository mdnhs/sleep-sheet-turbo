"use client";

import { Fragment, type ReactNode } from "react";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";

/**
 * Repeats one skeleton row (`children`) as many times as the list under
 * `listKey` showed last time, else `fallback` — see useSkeletonRows. The client
 * boundary for the settings skeletons, which stay importable from server files.
 */
export function SkeletonRows({
  listKey,
  fallback,
  min,
  children,
}: {
  listKey: string;
  fallback: number;
  /** See useSkeletonRows; 0 for lists that render nothing when empty. */
  min?: number;
  children: ReactNode;
}) {
  const rows = useSkeletonRows(listKey, fallback, min);
  return Array.from({ length: rows }, (_, i) => <Fragment key={i}>{children}</Fragment>);
}
