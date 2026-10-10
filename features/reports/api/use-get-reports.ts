import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetReportsOptions {
  from?: string;
  to?: string;
}

export const useGetReports = ({ from, to }: UseGetReportsOptions = {}) => {
  return useQuery({
    queryKey: ["reports", { from, to }],
    queryFn: async () => {
      const response = await client.api.reports.$get({
        query: {
          from,
          to,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      return response.json();
    },
    placeholderData: keepPreviousData,
  });
};
