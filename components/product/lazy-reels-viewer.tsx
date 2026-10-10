"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const load = () => import("@/components/product/reels-viewer");

/**
 * The Reels viewer, split into its own chunk: pages that show video cards
 * don't pay for it until it's needed. useWarmReelsViewer fetches the chunk
 * while the browser is idle, so the first tap still opens it instantly.
 */
const LazyReelsViewer = dynamic(load, { ssr: false });

// A shared /videos?v=<slug> link opens the viewer straight after hydration,
// and for that visit its poster is the LCP element — so start fetching the
// chunk as soon as this module runs instead of when the viewer first renders.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("v")) {
  void load().catch(() => {});
}

export default LazyReelsViewer;

export function useWarmReelsViewer() {
  useEffect(() => {
    const warm = () => void load().catch(() => {});
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 2000);
    return () => clearTimeout(id);
  }, []);
}
