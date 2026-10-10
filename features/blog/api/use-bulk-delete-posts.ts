"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBulkDeletePosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/blog/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || "Failed to delete posts");
      }
      return json;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} post(s) deleted`);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete posts");
    },
  });
}
