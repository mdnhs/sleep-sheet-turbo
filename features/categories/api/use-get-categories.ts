import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export type CategoryListItem = NonNullable<
  Awaited<ReturnType<typeof useGetCategories>>["data"]
>[number];

export const useGetCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await client.api.categories.$get();

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      return response.json();
    },
  });
};
