"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from "@/lib/types";
import { User } from "lucide-react";
import React from "react";
import ReviewForm from "./review-form";
import { formatDate, toTitleCase } from "@/lib/utils";
import { StarRating } from "@/features/review/components/star-rating";
import { useCurrent } from "@/features/auth/api/use-current";
import Link from "next/link";

interface ProductTabProps {
  product: Product;
}

function ProductTab({ product }: ProductTabProps) {
  const { data: user } = useCurrent();
  const currentUserId = user?.id;
  const existingReview = product.reviews.find(
    (review) => review.userId === currentUserId && review.userId !== undefined
  ) as
    | {
        id: string;
        rating: number;
        comment: string;
        userId: string;
      }
    | undefined;

  const averageRating =
    product.reviews.length > 0
      ? product.reviews.reduce((acc, review) => acc + review.rating, 0) /
        product.reviews.length
      : 0;

  return (
    <div className="mt-16">
      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary/30 rounded-xl p-1">
          <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5">Details</TabsTrigger>
          <TabsTrigger value="specifications" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5">Specifications</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5">
            Reviews ({product.reviewCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 bg-secondary/10 p-6 md:p-8 rounded-2xl">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
              Product Features
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              {product.features.map((feature, index) => (
                <li key={index} className="text-muted-foreground leading-relaxed">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
              Care Instructions
            </h3>
            <p className="text-muted-foreground leading-relaxed">{product.care}</p>
          </div>
        </TabsContent>

        <TabsContent value="specifications" className="bg-secondary/10 p-6 md:p-8 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/50">
              <tbody className="divide-y divide-border/50">
                {product.specifications.map((specification, index) => (
                  <tr key={index} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-4 px-4 md:px-6 font-medium text-foreground w-1/3">
                      {specification.key}
                    </td>
                    <td className="py-4 px-4 md:px-6 text-muted-foreground">
                      {specification.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Customer Reviews</h3>
                <div className="flex items-center mt-1">
                  <div className="flex items-center mr-2">
                    <StarRating rating={averageRating} />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Based on {product.reviewCount} reviews
                  </p>
                </div>
              </div>
            </div>

            {product?.reviewCount && product.reviewCount > 0 ? (
              <div className="space-y-6">
                {product?.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-border pb-6 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center">
                            <h4 className="font-medium mr-2">
                              {toTitleCase(review.name)}
                            </h4>
                            {review.verified && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(review.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "text-yellow-400 fill-current"
                                : "text-gray-300 dark:text-slate-600 fill-current"
                            }`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No reviews yet. Be the first to review this product.
              </p>
            )}

            {user ? (
              <ReviewForm
                productId={product.id}
                existingReview={existingReview}
              />
            ) : (
              <div className="flex flex-col text-center mt-6">
                <p className="text-md text-muted-foreground mb-2">
                  You must be logged in to leave a review.
                </p>
                <Link href={"/signin"}>
                  <p className=" underline text-md font-bold">
                    {" "}
                    Login to Submit Review
                  </p>
                </Link>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProductTab;
