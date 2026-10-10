import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";


export const useGetShippingMethods = () => {
  return useQuery({
    queryKey: ["shippingMethods"],
    queryFn: async () => {
      const response = await client.api.checkout["shipping-methods"].$get();

      if (!response.ok) {
        throw new Error("Failed to fetch shippingMethods");
      }

      return response.json();
    },
  });
};
