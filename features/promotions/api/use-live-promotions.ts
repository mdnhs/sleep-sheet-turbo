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
      const res = await client.api.promotions.live.$get({ query: {} });
      if (!res.ok) return [];
      return ((await res.json()) as { promotions: Promotion[] }).promotions;
    },
    // Shared live promotions cached at Cloudflare edge (1-2 min).
    // Stale time prevents window focus spamming.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
