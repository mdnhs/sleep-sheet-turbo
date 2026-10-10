
import { useAddWishList } from "@/features/wishlist/api/use-add-wishlist";
import { useDeleteFromWishlist } from "@/features/wishlist/api/use-delete-from-wishlist";
import { useWishlist } from "@/features/wishlist/api/use-wishlist";

interface UseWishlistToggleProps {
  productId: string;
}

export const useWishlistToggle = ({ productId }: UseWishlistToggleProps) => {
  const { mutate: addToWishlist, isPending: isAdding } = useAddWishList();
  const { mutate: deleteFromWishlist, isPending: isRemoving } = useDeleteFromWishlist();
  const { data: wishlist } = useWishlist();
  const isInWishlist = wishlist?.items.some((item) => item.product.id === productId);

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInWishlist) {
 
      deleteFromWishlist({ productId });
    } else {
      addToWishlist({ productId });
    }
  };

  return {
    handleWishlistToggle,
    isAdding,
    isRemoving,
    isInWishlist,
  };
};
