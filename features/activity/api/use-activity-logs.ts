import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface ActivityLogQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  orderId?: string;
  status?: "error";
}

export const useActivityLogs = (
  params?: ActivityLogQueryParams,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["activity-logs", params],
    queryFn: async () => {
      const response = await client.api.activity.$get({ query: params });

      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }

      return response.json();
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
};
