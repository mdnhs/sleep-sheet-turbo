"use client";

import * as React from "react";

// Pages declare their title with <PageTitle>; the dashboard header shows it
// on the left of the navbar (<PageTitleSlot>). A tiny external store keeps
// the two in sync without threading context through server layouts.

type Title = { title: string; description?: string } | null;

let current: Title = null;
const listeners = new Set<() => void>();

function setTitle(next: Title) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Renders nothing in place: puts the page's title and description in the dashboard navbar. */
export function PageTitle({ title, description }: { title: string; description?: string }) {
  React.useEffect(() => {
    setTitle({ title, description });
    return () => setTitle(null);
  }, [title, description]);
  return null;
}

/** The navbar's left side: the current page's title and description. */
export function PageTitleSlot() {
  const page = React.useSyncExternalStore(subscribe, () => current, () => null);
  if (!page) return null;
  return (
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">{page.title}</h1>
      {page.description && (
        <p className="hidden truncate text-xs leading-tight text-muted-foreground sm:block">{page.description}</p>
      )}
    </div>
  );
}
