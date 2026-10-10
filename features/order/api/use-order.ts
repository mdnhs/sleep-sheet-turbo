// hooks/useOrders.ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export interface OrderDateRangeFilter {
  from: string;
  to: string;
}

export interface UseOrdersOptions {
  enabled?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
}

export const useOrders = (
  search?: string,
  range?: OrderDateRangeFilter,
  options?: UseOrdersOptions
) => {
  const { status, limit, offset } = options ?? {};
  // Only the browser knows which day "today" is for whoever is looking, so the
  // TODAY filter is resolved against this rather than against the server's UTC.
  const tzOffset = new Date().getTimezoneOffset();
  return useQuery({
    // Everything that changes the response belongs in the key, the page window
    // included — otherwise turning a page would serve the previous page's rows.
    queryKey: ["orders", search, range, status, limit, offset],
    queryFn: async () => {
      const response = await client.api.orders.$get({
        query: {
          search,
          status,
          tzOffset: String(tzOffset),
          ...(limit !== undefined ? { limit: String(limit) } : {}),
          ...(offset ? { offset: String(offset) } : {}),
          ...(range ? { from: range.from, to: range.to } : {}),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      // `total` counts everything matching the filter, not just this page —
      // the table needs it to know how many pages there are. `counts` holds
      // every bucket within the current search, which is what lets the filter
      // tabs keep showing "Confirmed (194)" while the pending ones are on
      // screen; counting the page would show the page's own numbers.
      return {
        orders: data.orders,
        total: data.total ?? data.orders.length,
        counts: data.counts,
      };
    },
    enabled: options?.enabled ?? true,
    // Keep showing the previous result set while a new filter's query is in
    // flight, instead of flipping isLoading true and swapping out the UI.
    placeholderData: keepPreviousData,
  });
};
