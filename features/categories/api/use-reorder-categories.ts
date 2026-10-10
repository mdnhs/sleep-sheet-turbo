import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type CategoryOrder = {
  value: string;
  order: number;
};

export const useReorderCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orders: CategoryOrder[]) => {
      const response = await client.api.categories.reorder.$post({ json: { orders } });
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to update category order");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Category order updated");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};