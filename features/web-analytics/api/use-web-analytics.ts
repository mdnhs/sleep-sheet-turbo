"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import type { Dimension, Filters } from "../lib/dimensions";
import type { BreakdownRow, Funnel, LiveSnapshot, OverviewResponse, ProductRow } from "../lib/types";

export interface WaQuery {
  from: string;
  to: string;
  filters: Filters;
}

const api = client.api["web-analytics"];
const params = (q: WaQuery) => ({ from: q.from, to: q.to, ...q.filters });

export const useWaOverview = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "overview", q],
    queryFn: async () => {
      const res = await api.overview.$get({ query: params(q) });
      if (!res.ok) throw new Error("Failed to load analytics");
      return (await res.json()) as OverviewResponse;
    },
    placeholderData: keepPreviousData,
  });

export const useWaBreakdown = (q: WaQuery, dim: Dimension) =>
  useQuery({
    queryKey: ["web-analytics", "breakdown", dim, q],
    queryFn: async () => {
      const res = await api.breakdown.$get({ query: { ...params(q), dim, limit: "10" } });
      if (!res.ok) throw new Error("Failed to load breakdown");
      return (await res.json()) as { rows: BreakdownRow[] };
    },
    placeholderData: keepPreviousData,
  });

export const useWaFunnel = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "funnel", q],
    queryFn: async () => {
      const res = await api.funnel.$get({ query: params(q) });
      if (!res.ok) throw new Error("Failed to load funnel");
      return (await res.json()) as Funnel;
    },
    placeholderData: keepPreviousData,
  });

export const useWaProducts = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "products", q],
    queryFn: async () => {
      const res = await api.products.$get({ query: { ...params(q), limit: "20" } });
      if (!res.ok) throw new Error("Failed to load products");
      return (await res.json()) as { rows: ProductRow[] };
    },
    placeholderData: keepPreviousData,
  });

export const useWaLive = () =>
  useQuery({
    queryKey: ["web-analytics", "live"],
    queryFn: async () => {
      const res = await api.live.$get();
      if (!res.ok) throw new Error("Failed to load live visitors");
      return (await res.json()) as LiveSnapshot;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
