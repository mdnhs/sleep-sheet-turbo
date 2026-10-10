import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export const useGetCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await client.api.users.customers.$get();

      if (!res.ok) {
        throw new Error("Failed to fetch customers");
      }

      return await res.json();
    },
  });
};
