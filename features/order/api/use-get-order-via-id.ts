import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export const useGetOrderByID = (id: string) => {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const response = await client.api.orders[":id"].$get({ param: { id } });
    

      if (!response.ok) {
        throw new Error("Failed to fetch order");
      }

      return response.json();
    },
    enabled: !!id, 
  });
};
