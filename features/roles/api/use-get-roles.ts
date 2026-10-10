import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export type Role = NonNullable<
  Awaited<ReturnType<typeof useGetRoles>>["data"]
>[number];

export const useGetRoles = () => {
  const query = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await client.api.roles.$get();

      if (!res.ok) {
        throw new Error("Failed to fetch roles");
      }

      return await res.json();
    },
  });

  return query;
};
