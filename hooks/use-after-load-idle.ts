"use client";

import { useEffect, useState } from "react";
import { afterLoadIdle } from "@/lib/after-load-idle";

/**
 * False until the window has loaded and the main thread is idle. Gate
 * non-critical images on it (hidden carousel slides, off-screen posters) so
 * they don't download alongside the LCP image — Lighthouse counts every
 * request that starts before LCP against it.
 */
export function useAfterLoadIdle(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => afterLoadIdle(() => setReady(true)), []);
  return ready;
}
