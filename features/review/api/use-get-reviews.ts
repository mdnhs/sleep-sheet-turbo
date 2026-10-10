import { useInfiniteQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { REVIEWS_PAGE_SIZE } from "../constants";

type ReviewsPage = Awaited<ReturnType<typeof fetchReviewsPage>>;

async function fetchReviewsPage(productId: string, page: number) {
  const response = await client.api.reviews.$get({
    query: {
      productId,
      page: String(page),
      limit: String(REVIEWS_PAGE_SIZE),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }

  return response.json();
}

// Loads a product's reviews a page at a time ("Show more"), seeded with the
// first page the server already embedded on the product itself (see
// features/product/server/get-product.ts) so mounting this never re-fetches
// page 1 — it only fires a network request once the visitor asks for more.
export const useGetReviews = (productId: string, initialPage?: ReviewsPage) => {
  return useInfiniteQuery({
    queryKey: ["reviews", productId],
    queryFn: ({ pageParam }) => fetchReviewsPage(productId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.success && lastPage.hasNextPage ? allPages.length + 1 : undefined,
    enabled: Boolean(productId),
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [1] }
      : undefined,
  });
};
