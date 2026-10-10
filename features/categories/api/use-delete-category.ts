import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface useDeleteCategoryProps{
    value:string
}

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({value}:useDeleteCategoryProps) => {
      const response = await client.api.categories.delete[":value"].$delete({
        param: { value }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error("Failed to delete category");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
