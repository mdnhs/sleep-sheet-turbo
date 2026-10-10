import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useUpdateReview = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rating,
      comment,
      reviewId,
    }: {
      rating: number;
      comment: string;
      reviewId: string;
    }) => {
      const res = await client.api.reviews[":reviewId"].$put({
        param: { reviewId },
        json: { rating, comment },
      });

      if (!res.ok) {
        throw new Error("Failed to update review");
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product", productId],
      });
      toast.success("Review updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Something went wrong");
    },
  });
};

export const useDeleteReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      if (!reviewId) throw new Error("Review ID required");

      return await client.api.reviews[":reviewId"].$delete({
        param: { reviewId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review Deleted");
    },
    onError: () => {
      toast.error("Failed to Delete review");
    },
  });
};
