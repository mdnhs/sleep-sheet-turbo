import { keepPreviousData, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface ProductQueryParams {
  category?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  search?: string;
  limit?: string;
  featured?: string;
  admin?: string;
  pos?: string;
}

export const useGetProducts = (params?: ProductQueryParams) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const response = await client.api.products.$get({
        query: params,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      return response.json();
    },
    // The global default staleTime (5 min, see provider/query-provider.tsx)
    // was letting the dashboard products list and POS show a cached page
    // instead of refetching on mount — stock/price/featured edits made
    // elsewhere wouldn't show up until the cache expired. Product data
    // needs to always come from a fresh request, not this client cache.
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
};

export interface UseGetInfiniteProductsOptions {
  initialData?: {
    pages: Array<{
      data: any[];
      totalCount?: number;
      currentPage?: number;
      totalPages?: number;
      hasNextPage?: boolean;
    }>;
    pageParams: number[];
  };
  staleTime?: number;
}

export const useGetInfiniteProducts = (
  params?: Omit<ProductQueryParams, "page">,
  options?: UseGetInfiniteProductsOptions
) => {
  const isInternal = Boolean(params?.admin === "true" || params?.pos === "true");
  return useInfiniteQuery({
    queryKey: ["products", "infinite", params],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await client.api.products.$get({
        query: {
          ...params,
          page: pageParam.toString(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      return response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasNextPage ? allPages.length + 1 : undefined;
    },
    // POS and dashboard admin grids need fresh stock/price numbers immediately.
    // Public storefront visitors use a 2-minute stale window to avoid duplicate
    // fetches on initial mount and tab-switches.
    staleTime: isInternal ? 0 : (options?.staleTime ?? 2 * 60 * 1000),
    initialData: options?.initialData,
  });
};

interface DuplicateProductsParams {
  category?: string;
  search?: string;
}

export const useGetDuplicateProducts = (
  params?: DuplicateProductsParams,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["products", "duplicates", params],
    queryFn: async () => {
      const response = await client.api.products.duplicates.$get({
        query: params,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch duplicate products");
      }

      return response.json();
    },
    staleTime: 0,
    enabled: options?.enabled,
  });
};

/** Reels analytics per video, for the dashboard (admin/moderator only). */
export const useGetVideoStats = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["products", "video-stats"],
    queryFn: async () => {
      const response = await client.api.products.videos.stats.$get();
      if (!response.ok) throw new Error("Failed to fetch video stats");
      return (await response.json()) as {
        data: Record<string, { views: number; watchSeconds: number; orderClicks: number; shares: number }>;
      };
    },
    staleTime: 60_000,
    enabled: options?.enabled,
  });
};
