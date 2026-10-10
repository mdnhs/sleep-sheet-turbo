import { client } from "@/lib/rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddWishListProps {
  productId: string;
}

export const useAddWishList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId }: AddWishListProps) => {
      const response = await client.api.wishlist.$post({
        json: {
          productId,
       
        },
      });
      if (!response.ok) {
    
        throw new Error("Failed to Add to Wishlist ");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      // useWishlist now reads off the shared ["current"] query (see use-wishlist.ts).
      queryClient.invalidateQueries({ queryKey: ["current"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
