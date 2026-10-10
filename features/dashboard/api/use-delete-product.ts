"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/product/${productId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        const err = (json as { error?: string }).error;
        throw new Error(err || "Failed to delete product");
      }
      return json;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete product");
    },
  });
}
