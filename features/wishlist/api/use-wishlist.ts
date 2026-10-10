import { useQuery } from "@tanstack/react-query";

import { CURRENT_QUERY_KEY, fetchCurrentBundle } from "@/features/auth/api/use-current";

// Shares the ["current"] query with useCurrent() — /api/auth/current already
// returns the wishlist bundled with the session user, so this just selects
// that slice instead of hitting /api/wishlist separately on every page load.
export const useWishlist = (enabled: boolean = true) => {
  return useQuery({
    queryKey: CURRENT_QUERY_KEY,
    queryFn: fetchCurrentBundle,
    enabled,
    staleTime: 10 * 60 * 1000,
    select: (bundle) => bundle.wishlist,
  });
};
