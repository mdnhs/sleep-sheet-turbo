"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { afterNextPaint } from "@/lib/after-next-paint";
import { getVisitorId } from "@/lib/visitor-id";
import type { ProductVideoItem } from "@/lib/types";

const LIKED_KEY = "ss_liked_videos";

function readLiked(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeLiked(liked: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...liked]));
  } catch {
    /* storage unavailable — the like still counts server-side */
  }
}

/**
 * Like state for the Reels viewer. Guests can like: the browser's anonymous
 * visitor id identifies them, "liked by me" is remembered in localStorage, and
 * the server keeps one row per (video, visitor) so the total can't be
 * inflated by tapping repeatedly. Counts start from the (cached) list, are
 * refreshed from the live endpoint on mount, and update instantly on a tap.
 *
 * Only meant for client-only components (it reads localStorage in its initial
 * state) — the Reels viewer is never rendered on the server.
 */
export function useVideoLikes(items: ProductVideoItem[], failureMessage: string) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.likes ?? 0])),
  );
  const [liked, setLiked] = useState<Set<string>>(readLiked);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products/videos/likes")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: Record<string, number> } | null) => {
        if (cancelled || !body) return;
        // Every video's total — including ones added to the viewer after it opened.
        setCounts((prev) => ({ ...prev, ...body.data }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // `toggle` and `like` read the liked set through this ref, so they keep one
  // identity for the viewer's lifetime: the memoized slides take them as props,
  // and a new function on every like would re-render every slide.
  const likedRef = useRef(liked);

  const toggle = useCallback(
    async (id: string) => {
      const next = !likedRef.current.has(id);

      // Optimistic: flip the heart and the number now, reconcile with the server after.
      const apply = (value: boolean, delta: number) => {
        const copy = new Set(likedRef.current);
        if (value) copy.add(id);
        else copy.delete(id);
        likedRef.current = copy;
        setLiked(copy);
        setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
        // Not inside the tap: localStorage is synchronous I/O.
        afterNextPaint(() => writeLiked(copy));
      };
      apply(next, next ? 1 : -1);

      try {
        const res = await fetch(`/api/products/videos/${id}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: getVisitorId(), liked: next }),
        });
        if (!res.ok) throw new Error("like failed");
        const data = (await res.json()) as { likes: number };
        setCounts((prev) => ({ ...prev, [id]: data.likes }));
      } catch {
        apply(!next, next ? -1 : 1);
        toast.error(failureMessage);
      }
    },
    [failureMessage],
  );

  /** Like only — what a double tap does; it never takes a like back. */
  const like = useCallback(
    (id: string) => {
      if (!likedRef.current.has(id)) void toggle(id);
    },
    [toggle],
  );

  return { counts, liked, toggle, like };
}
