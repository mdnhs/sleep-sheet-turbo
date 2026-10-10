"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBulkDeleteCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: string[]) => {
      const res = await fetch("/api/categories/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || "Failed to delete categories");
      }
      return json;
    },
    onSuccess: () => {
      toast.success("Categories deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete categories");
    },
  });
}
