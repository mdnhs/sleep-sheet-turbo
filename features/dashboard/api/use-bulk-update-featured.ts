import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useBulkUpdateFeatured = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, isFeatured }: { ids: string[]; isFeatured: boolean }) => {
      const res = await fetch("/api/product/bulk-feature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, isFeatured }),
      });
      if (!res.ok) {
        throw new Error("Failed to update feature status");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Products updated successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => {
      toast.error("Failed to update products");
    },
  });
};
