import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export const useGetUsers = () => {
  const query = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await client.api.users.$get();

      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }

      return await res.json();
    },
  });

  return query;
};
