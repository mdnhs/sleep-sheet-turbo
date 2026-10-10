"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import type { Dimension, Filters } from "../lib/dimensions";
import type {
  BreakdownRow,
  CheckoutDraftRow,
  DraftSummary,
  Funnel,
  LiveSnapshot,
  OverviewResponse,
  ProductRow,
} from "../lib/types";

export interface WaQuery {
  from: string;
  to: string;
  filters: Filters;
}

export interface Paged<T> {
  rows: T[];
  hasMore: boolean;
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

export const BREAKDOWN_PAGE_SIZE = 10;

export const useWaBreakdown = (q: WaQuery, dim: Dimension, page: number) =>
  useQuery({
    queryKey: ["web-analytics", "breakdown", dim, q, page],
    queryFn: async () => {
      const res = await api.breakdown.$get({
        query: { ...params(q), dim, limit: String(BREAKDOWN_PAGE_SIZE), offset: String(page * BREAKDOWN_PAGE_SIZE) },
      });
      if (!res.ok) throw new Error("Failed to load breakdown");
      return (await res.json()) as Paged<BreakdownRow>;
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

export const PRODUCTS_PAGE_SIZE = 10;

export const useWaProducts = (q: WaQuery, page: number) =>
  useQuery({
    queryKey: ["web-analytics", "products", q, page],
    queryFn: async () => {
      const res = await api.products.$get({
        query: { ...params(q), limit: String(PRODUCTS_PAGE_SIZE), offset: String(page * PRODUCTS_PAGE_SIZE) },
      });
      if (!res.ok) throw new Error("Failed to load products");
      return (await res.json()) as Paged<ProductRow>;
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

export const DRAFTS_PAGE_SIZE = 10;

export const useWaDrafts = (page: number) =>
  useQuery({
    queryKey: ["web-analytics", "drafts", page],
    queryFn: async () => {
      const res = await api.drafts.$get({
        query: { limit: String(DRAFTS_PAGE_SIZE), offset: String(page * DRAFTS_PAGE_SIZE) },
      });
      if (res.status === 403) return null;
      if (!res.ok) throw new Error("Failed to load incomplete checkouts");
      return (await res.json()) as Paged<CheckoutDraftRow> & { summary: DraftSummary };
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

export const useDismissDraft = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.drafts[":id"].dismiss.$post({ param: { id: String(id) } });
      if (!res.ok) throw new Error("Failed to dismiss");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["web-analytics", "drafts"] }),
  });
};
