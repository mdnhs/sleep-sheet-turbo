"use client";

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button-variants";

// Next.js 16 renamed the recovery prop from `reset` to `unstable_retry` (it
// re-fetches and re-renders the segment instead of just clearing local
// error state) — see node_modules/next/dist/docs/.../file-conventions/error.md.
//
// Plain <button>/<a> with the button classes rather than Button/next/link:
// this boundary's chunk loads with every page, and those components only
// duplicated code the page chunks already carry.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        An unexpected error occurred. You can try again, or go back to the homepage.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => unstable_retry()} className={buttonVariants()}>
          Try again
        </button>
        {/* A full page load is what's wanted after an error anyway. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </a>
      </div>
    </div>
  );
}
