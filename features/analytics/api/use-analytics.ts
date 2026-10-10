import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export interface DateRangeFilter {
  from: string;
  to: string;
}

export const useSalesOverview = (period = "month", range?: DateRangeFilter) =>
  useQuery({
    queryKey: ["sales-overview", period, range],
    queryFn: async () => {
      const res = await client.api.analytics["sales-overview"].$get({
        query: range ? { period, from: range.from, to: range.to } : { period },
      });
      if (!res.ok) throw new Error("Failed to fetch sales overview");
      return res.json();
    },
  });

export const useGeographicDistribution = () =>
  useQuery({
    queryKey: ["distribution"],
    queryFn: async () => {
      const res = await client.api.analytics["distribution"].$get();
      if (!res.ok) throw new Error("Failed to fetch distribution data");
      return res.json();
    },
  });

// export const useCategoryBreakdown = () =>
//   useQuery({
//     queryKey: ["categories"],
//     queryFn: async () => {
//       const res = await client.api.analytics["categories"].$get();
//       if (!res.ok) throw new Error("Failed to fetch categories");
//       return res.json();
//     },
//   });

/**
 * One request for the whole dashboard overview.
 *
 * The nine parameterless panels below used to be nine `useQuery` calls
 * against nine endpoints. React Query fired them all on mount, so a dashboard
 * load meant nine HTTP requests, nine session lookups and — underneath —
 * twelve database round trips, each one waking the Neon compute in turn.
 * They are all read from the same page at the same moment, so they are now
 * one batched request (see the /overview handler).
 *
 * The individual hooks are kept with their original names and return shapes
 * and are selectors over this one query, so the dashboard did not have to
 * change and React Query still dedupes them down to a single fetch.
 */
export const useDashboardOverview = () =>
  useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const res = await client.api.analytics["overview"].$get();
      if (!res.ok) throw new Error("Failed to fetch dashboard overview");
      return res.json();
    },
  });

/** Narrow the shared overview query to one panel, keeping `{ data, isLoading }`. */
function useOverviewSlice<K extends keyof OverviewData>(key: K) {
  const { data, isLoading, error } = useDashboardOverview();
  return { data: data?.[key], isLoading, error };
}

type OverviewData = NonNullable<ReturnType<typeof useDashboardOverview>["data"]>;

export const useCustomerLifetimeValue = () => useOverviewSlice("clv");
export const useInventoryTurnover = () => useOverviewSlice("inventoryTurnover");
export const useCartAbandonment = () => useOverviewSlice("abandonment");
export const useCohortRetention = () => useOverviewSlice("cohort");
export const useSpendingClusters = () => useOverviewSlice("spendingClusters");
export const useMostPurchased = () => useOverviewSlice("mostPurchased");
export const useMostWishlisted = () => useOverviewSlice("mostWishlisted");
export const useRecentOrders = () => useOverviewSlice("recentOrders");
export const useLowStock = () => useOverviewSlice("lowStock");

// Parameterised by the dashboard's period/date-range picker, so it changes
// independently of the panels above and keeps its own query.
export const useCustomerAcquisition = (period = "month", range?: DateRangeFilter) =>
  useQuery({
    queryKey: ["acquisition", period, range],
    queryFn: async () => {
      const res = await client.api.analytics["acquisition"].$get({
        query: range ? { period, from: range.from, to: range.to } : { period },
      });
      if (!res.ok) throw new Error("Failed to fetch acquisition data");
      return res.json();
    },
  });

