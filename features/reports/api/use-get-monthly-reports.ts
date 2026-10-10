import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetMonthlyReportsOptions {
  from?: string;
  to?: string;
}

export const useGetMonthlyReports = ({ from, to }: UseGetMonthlyReportsOptions = {}) => {
  return useQuery({
    queryKey: ["reports", "monthly", { from, to }],
    queryFn: async () => {
      const response = await client.api.reports.monthly.$get({
        query: {
          from,
          to,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch monthly reports");
      }

      return response.json();
    },
  });
};
