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

export const DRAFTS_PAGE_SIZE = 5;

export type DraftView = "open" | "completed";

type DraftsPage = Paged<CheckoutDraftRow> & { summary: DraftSummary };

const DRAFTS_KEY = ["web-analytics", "drafts"] as const;

/** Drafts captured in the dashboard range (date only: the dimension filters don't apply to leads). */
export const useWaDrafts = (q: WaQuery, view: DraftView, page: number) =>
  useQuery({
    queryKey: [...DRAFTS_KEY, q.from, q.to, view, page],
    queryFn: async () => {
      const res = await api.drafts.$get({
        query: { from: q.from, to: q.to, view, limit: String(DRAFTS_PAGE_SIZE), offset: String(page * DRAFTS_PAGE_SIZE) },
      });
      if (res.status === 403) return null;
      if (!res.ok) throw new Error("Failed to load incomplete checkouts");
      return (await res.json()) as DraftsPage;
    },
    placeholderData: keepPreviousData,
    // New drafts and other staff members' actions show up without a reload.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

/**
 * Closing an open draft (recover / dismiss): drop it from every cached page
 * and adjust the counts right away, roll back if the request fails, then
 * refetch so moved rows land on the right page.
 */
function useCloseDraft(action: "recover" | "dismiss") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.drafts[":id"][action].$post({ param: { id: String(id) } });
      if (!res.ok) throw new Error(action === "recover" ? "Failed to mark completed" : "Failed to dismiss");
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: DRAFTS_KEY });
      const snapshot = queryClient.getQueriesData<DraftsPage | null>({ queryKey: DRAFTS_KEY });
      const row = snapshot.flatMap(([, data]) => data?.rows ?? []).find((r) => r.id === id && r.status === "open");
      if (!row) return { snapshot };
      const captured = new Date(row.createdAt).getTime();
      for (const [key, data] of snapshot) {
        if (!data) continue;
        // Key: [...DRAFTS_KEY, from, to, view, page]. Counts only move for ranges holding the lead.
        const [, , from, to] = key as [string, string, string, string];
        const inRange = captured >= new Date(from).getTime() && captured <= new Date(to).getTime();
        const rows = data.rows.filter((r) => r.id !== id);
        if (!inRange) {
          queryClient.setQueryData(key, { ...data, rows });
          continue;
        }
        const { summary } = data;
        queryClient.setQueryData<DraftsPage>(key, {
          ...data,
          rows,
          summary: {
            ...summary,
            // A dismissed draft leaves the total; a recovered one stays in it.
            total: Math.max(0, summary.total - (action === "dismiss" ? 1 : 0)),
            open: Math.max(0, summary.open - 1),
            recovered: summary.recovered + (action === "recover" ? 1 : 0),
            value: Math.max(0, summary.value - row.value),
          },
        });
      }
      return { snapshot };
    },
    onError: (_err, _id, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DRAFTS_KEY }),
  });
}

export const useDismissDraft = () => useCloseDraft("dismiss");

/** Staff closed the sale on a call / WhatsApp: the draft moves to the completed tab. */
export const useRecoverDraft = () => useCloseDraft("recover");
