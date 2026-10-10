"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Next.js 16 renamed the recovery prop from `reset` to `unstable_retry` (it
// re-fetches and re-renders the segment instead of just clearing local
// error state) — see node_modules/next/dist/docs/.../file-conventions/error.md.
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
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Go home
        </Button>
      </div>
    </div>
  );
}
