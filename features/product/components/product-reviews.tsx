"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Product } from "@/lib/types";
import { formatDate, toTitleCase } from "@/lib/utils";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetReviews } from "@/features/review/api/use-get-reviews";

// The form (react-hook-form + zod) only renders inside the "Write a Review"
// dialog, yet a static import shipped it — zod's ~290KB included — in the
// JS every product page hydrates with. Now it loads when the dialog opens.
const ReviewForm = dynamic(() => import("./review-form"));

interface ProductReviewsProps {
  product: Product;
}

export function ProductReviews({ product }: ProductReviewsProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // `product.reviews` is only the first page (see get-product.ts) — seed the
  // infinite query with it so mounting doesn't immediately re-fetch page 1,
  // and "Show more" pages in the rest through GET /api/reviews instead of
  // slicing an array that was already fully downloaded.
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetReviews(
    product.id,
    {
      success: true,
      // `Review.userId` is optional in the shared type (a review could in
      // principle be shown without it), but the GET /api/reviews shape this
      // seeds always has one — reviews are always created against a
      // logged-in user (features/review/server/route.ts).
      data: product.reviews.map((review) => ({ ...review, userId: review.userId ?? "" })),
      total: product.reviewCount ?? product.reviews.length,
      hasNextPage: (product.reviewCount ?? product.reviews.length) > product.reviews.length,
    },
  );

  const loadedReviews = data?.pages.flatMap((page) => (page.success ? page.data : [])) ?? product.reviews;
  const averageRating = product.rating ?? 0;
  const totalReviews = product.reviewCount ?? loadedReviews.length;

  const getRatingCount = (stars: number) => product.ratingBreakdown?.[stars] ?? 0;

  return (
    <div className="w-full mt-20">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Rating & Reviews</h2>
        <Button
          variant="outline"
          onClick={() => setIsReviewOpen(true)}
          className="rounded-full px-5 font-semibold text-sm border-border hover:bg-secondary/50"
        >
          <Star className="h-4 w-4 mr-1.5 text-yellow-500 fill-yellow-500" />
          Write a Review
        </Button>
      </div>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <ReviewForm productId={product.id} />
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-16 items-start">

        {/* Left Side: Score & Bars */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-8 items-center sm:items-stretch lg:items-stretch lg:sticky lg:top-24">
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-1">
              <span className="text-7xl font-bold tracking-tighter text-foreground leading-none">{averageRating.toFixed(1).replace('.', ',')}</span>
              <span className="text-2xl text-muted-foreground font-medium">/ 5</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">({totalReviews} New Reviews)</p>
          </div>

          <div className="flex-1 w-full max-w-[200px] flex flex-col gap-2 justify-center">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = getRatingCount(star);
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-8">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    <span className="text-xs font-medium">{star}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Reviews List */}
        <div className="w-full">
          {loadedReviews.length > 0 ? (
            <>
              <div className="flex flex-col divide-y divide-border/60">
                {loadedReviews.map((review) => (
                  <div key={review.id} className="flex gap-4 py-6 first:pt-0">
                    <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden shrink-0">
                      {/* Lazy: React's SSR preloads every eager <img> in the
                          head, so these below-the-fold avatars were fetched
                          (from a third-party origin) alongside the LCP image. */}
                      <img
                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${review.name}`}
                        alt={review.name}
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1.5">
                        <h4 className="font-semibold text-sm text-foreground">{toTitleCase(review.name)}</h4>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDate(review.date)}</span>
                      </div>
                      <div className="flex mb-2">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={i < review.rating ? "text-yellow-400" : "text-secondary"}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        &quot;{review.comment}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full px-6 font-semibold text-sm border-border hover:bg-secondary/50"
                  >
                    {isFetchingNextPage
                      ? "Loading…"
                      : `Show more reviews (${totalReviews - loadedReviews.length} left)`}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground text-sm gap-3">
              <p>No reviews yet. Be the first to review!</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsReviewOpen(true)}
                className="rounded-full font-medium"
              >
                Write the first review
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Default export so `next/dynamic(() => import(...))` can code-split this
// without a `.then(mod => mod.ProductReviews)` — Turbopack couldn't resolve
// the module id for SSR through that indirection and silently fell back to
// client-only rendering, bailing out the whole page.
export default ProductReviews;
