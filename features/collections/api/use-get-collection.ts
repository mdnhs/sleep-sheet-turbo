import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";


export const useGetCollection = () => {
  return useQuery({
    queryKey: ["collection"],
    queryFn: async () => {
      const response = await client.api.collection.$get();

      if (!response.ok) {
        throw new Error("Failed to fetch Collection");
      }

      return response.json();
    },
  });
};
