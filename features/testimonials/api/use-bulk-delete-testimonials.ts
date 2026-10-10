"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBulkDeleteTestimonials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/testimonials/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || "Failed to delete testimonials");
      }
      return json;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} testimonial(s) deleted`);
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete testimonials");
    },
  });
}
