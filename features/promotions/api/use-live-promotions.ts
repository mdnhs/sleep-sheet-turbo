"use client";

import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { getVisitorId } from "@/lib/visitor-id";
import type { Promotion } from "../types";

/**
 * Promotions live right now for this visitor (personal time limits applied, see
 * personalizePromotions). Checkout uses them to show free delivery before the
 * order is placed.
 */
export const useLivePromotions = () =>
  useQuery({
    queryKey: ["promotions", "live"],
    queryFn: async () => {
      const res = await client.api.promotions.live.$get({ query: { visitor: getVisitorId() } });
      if (!res.ok) return [];
      return ((await res.json()) as { promotions: Promotion[] }).promotions;
    },
    // Fresh on every checkout visit and tab focus, so a promotion created or
    // switched off a moment ago shows the right delivery charge. Cheap: the
    // server serves this list from cache (features/promotions/server).
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
