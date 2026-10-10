"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBulkDeleteProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/product/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = (json as { error?: string }).error;
        throw new Error(err || "Failed to delete products");
      }
      return json;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} product(s) deleted`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete products");
    },
  });
}
