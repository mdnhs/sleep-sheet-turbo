import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";


export const useGetOrder = () => {
  return useQuery({
    queryKey: ["order",],
    queryFn: async () => {
      const response = await client.api.orders["order"].$get();

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      return response.json();
    },
  });
};
