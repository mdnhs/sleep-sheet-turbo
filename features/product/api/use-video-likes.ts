"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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

  const toggle = useCallback(
    async (id: string) => {
      const next = !liked.has(id);

      // Optimistic: flip the heart and the number now, reconcile with the server after.
      const apply = (value: boolean, delta: number) => {
        setLiked((prev) => {
          const copy = new Set(prev);
          if (value) copy.add(id);
          else copy.delete(id);
          writeLiked(copy);
          return copy;
        });
        setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
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
    [liked, failureMessage],
  );

  return { counts, liked, toggle };
}
