import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

export const CURRENT_QUERY_KEY = ["current"] as const;

// /api/auth/current returns the session user bundled with their wishlist
// (see features/auth/server/route.ts) so this single fetch backs both
// useCurrent() and useWishlist() instead of each firing its own request.
export async function fetchCurrentBundle() {
  if (typeof window !== "undefined") {
    const hasSessionCookie = document.cookie.includes("has_session=1");
    const isMarkedGuest = sessionStorage.getItem("is_guest") === "1";

    // If client is already known to be a guest in this browser session
    // and holds no session cookie, avoid the serverless network round-trip.
    if (!hasSessionCookie && isMarkedGuest) {
      return { user: null, wishlist: { wishlistId: "", items: [] } };
    }
  }

  const response = await client.api.auth.current.$get();
  if (!response.ok) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("is_guest", "1");
    }
    return { user: null, wishlist: { wishlistId: "", items: [] } };
  }

  const { data, wishlist } = await response.json();

  if (typeof window !== "undefined") {
    if (data) {
      sessionStorage.removeItem("is_guest");
      document.cookie = "has_session=1; path=/; max-age=604800; SameSite=Lax";
    } else {
      sessionStorage.setItem("is_guest", "1");
    }
  }

  return { user: data, wishlist };
}

export const useCurrent = () => {
  const query = useQuery({
    queryKey: CURRENT_QUERY_KEY,
    queryFn: fetchCurrentBundle,
    staleTime: 10 * 60 * 1000,
    select: (bundle) => bundle.user,
  });
  return query;
};
