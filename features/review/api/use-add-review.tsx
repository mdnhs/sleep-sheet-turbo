import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddReviewProps {
  productId: string;
  rating: number;
  comment: string;
}

export const useAddReview = (productId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, rating, comment }: AddReviewProps) => {
      const response = await client.api.reviews.$post({
        json: {
          productId,
          rating,
          comment,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Review submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
