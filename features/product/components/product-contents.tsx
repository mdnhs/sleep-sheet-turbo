"use client";

import { sortOptions } from "@/lib/utils";
import React, { useEffect } from "react";
import { useGetInfiniteProducts } from "../api/use-get-products";
import ProductCard from "@/components/product/product-card";
import { ProductCardSkeleton } from "@/components/product/product-card-skeleton";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";
import { useInView } from "react-intersection-observer";

import { MobileFilterSheet } from "./products-sidebar";
import type { ProductSummary } from "@/lib/types";

interface ProductContentsProps {
  // Seeds the category filter for routes like /categories/[value] without
  // putting it in the URL query string — the ?category= query param (set by
  // the sidebar filters) still takes precedence once the user picks one.
  initialCategory?: string;
  // Same idea, for routes like /bestsellers that default to a specific sort
  // without needing a ?sort= query string.
  initialSort?: string;
  initialProducts?: ProductSummary[];
}

export function ProductGridSkeleton() {
  // Same grid as the real list below, filled with ProductCard-shaped cards.
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3" aria-hidden="true">
      {[...Array(8)].map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

function ProductContents({
  initialCategory,
  initialSort,
  initialProducts,
}: ProductContentsProps = {}) {
  const [category] = useQueryState("category", {
    defaultValue: initialCategory || "",
  });
  const [minPrice] = useQueryState("minPrice", { defaultValue: "" });
  const [maxPrice] = useQueryState("maxPrice", { defaultValue: "" });
  const [search] = useQueryState("search", { defaultValue: "" });
  const [sort, setSort] = useQueryState("sort", {
    defaultValue: initialSort || "",
    shallow: false,
  });

  const handleSortChange = (value: string | null) => {
    setSort(value || null);
  };

  const isDefaultFilter =
    Boolean(initialProducts && initialProducts.length > 0) &&
    !minPrice &&
    !maxPrice &&
    !search &&
    category === (initialCategory || "") &&
    sort === (initialSort || "");

  const initialData = isDefaultFilter && initialProducts
    ? {
        pages: [
          {
            data: initialProducts,
            totalCount: initialProducts.length,
            currentPage: 1,
            totalPages: 1,
            hasNextPage: initialProducts.length >= 8,
          },
        ],
        pageParams: [1],
      }
    : undefined;

  const {
    data: productsPages,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetInfiniteProducts(
    {
      category: category,
      minPrice: minPrice,
      maxPrice: maxPrice,
      sort: sort,
      search: search,
    },
    { initialData }
  );

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px", // Trigger slightly before the bottom
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const fetchedProducts =
    productsPages?.pages.flatMap((page) => page.data) || [];
  const allProducts =
    fetchedProducts.length > 0 ? fetchedProducts : initialProducts || [];

  return (
    <div className="w-full">
      {/* Floating trigger now (see products-sidebar.tsx) — it's fixed-positioned,
          so this no longer needs a row (or that row's border) to sit in. */}
      <MobileFilterSheet initialCategory={initialCategory} />

      {/* Skeleton while a new filter or sort loads, instead of leaving the
          previous list up. */}
      {isLoading ? (
        <ProductGridSkeleton />
      ) : (
        <div>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3"
            aria-busy={isFetchingNextPage}
          >
            {allProducts.map((product, index: number) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
              />
            ))}
            {/* Next page loading: placeholder cards where it will land. */}
            {isFetchingNextPage &&
              [...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={`next-page-skeleton-${i}`} />
              ))}
          </div>

          {allProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] gap-4 text-center">
              <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">
                No products found
              </h3>
              <p className="text-muted-foreground max-w-[300px]">
                Try adjusting your filters or search query to find what
                you&apos;re looking for.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Infinite Scroll Trigger (the skeleton cards above are its loading state) */}
      {hasNextPage && (
        <div ref={ref} aria-hidden="true" className="w-full py-10 mt-4">
          <div className="h-6" />
        </div>
      )}

      {!hasNextPage && allProducts.length > 0 && (
        <div className="w-full text-center py-10 mt-4 text-muted-foreground text-sm pb-24">
          You&apos;ve reached the end!
        </div>
      )}

      {/* Floating Bottom Sort Tab */}
      <div className="fixed bottom-26 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center p-1.5 bg-background/80 backdrop-blur-md border border-border/50 rounded-full shadow-2xl">
        {[
          { label: "New Arrival", value: "newest" },
          { label: "Low to High", value: "price-asc" },
          { label: "High to Low", value: "price-desc" },
        ].map((option) => {
          const isActive = (sort || "newest") === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                isActive
                  ? "bg-foreground text-background shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ProductContents;
