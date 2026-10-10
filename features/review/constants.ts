// Shared between the product detail page's initial embedded review page
// (features/product/server/get-product.ts) and the paginated GET /api/reviews
// endpoint (features/review/server/route.ts) so "Show more" fetches pages
// that line up exactly with what was already rendered.
export const REVIEWS_PAGE_SIZE = 4;
