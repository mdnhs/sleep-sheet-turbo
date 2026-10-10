import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";


export const useGetOrders = () => {
  return useQuery({
    queryKey: ["orders",],
    queryFn: async () => {
      const response = await client.api.orders.$get();

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      return response.json();
    },
  });
};
