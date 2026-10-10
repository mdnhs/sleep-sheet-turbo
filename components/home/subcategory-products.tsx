"use client";

import React from "react";
import CategoryCarousel from "./category-carousel";
import { useGetCategories, type CategoryListItem } from "@/features/categories/api/use-get-categories";
import { ProductCarouselSkeleton } from "@/components/product/product-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface SubcategoryProductsProps {
  initialData?: CategoryListItem[];
}

const SubcategoryProducts = ({ initialData }: SubcategoryProductsProps = {}) => {
  const { data, isLoading } = useGetCategories();

  const categories = (data && data.length > 0) ? data : initialData || [];

  if (isLoading && categories.length === 0) {
    return (
      <section className="py-4 md:py-6 border-t border-slate-100 dark:border-slate-800 bg-[#F4F4F4] dark:bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-row items-end justify-between mb-3 md:mb-4">
            <Skeleton className="h-7 w-48 md:h-8" />
            <Skeleton className="h-4 w-16" />
          </div>
          <ProductCarouselSkeleton />
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  // Filter for subcategories (categories that have a parentId)
  const subcategories = categories.filter((c) => c.parentId !== null);

  // If there are no subcategories, maybe fallback to all categories or just render nothing
  const candidateCategories = subcategories.length > 0 ? subcategories : categories;

  // Categories with no products render an empty CategoryCarousel that
  // unmounts to null once its own product fetch resolves, collapsing that
  // section's skeleton height to 0 and shifting everything below it.
  // Filtering them out up front means a carousel only ever mounts when it
  // actually has something to show.
  const displayCategories = candidateCategories.filter(
    (c) => (c.productCount ?? 0) > 0,
  );

  return (
    <div>
      {displayCategories.map((category, index: number) => (
        <CategoryCarousel
          key={category.id}
          categoryLabel={category.label}
          categoryValue={category.value}
          categoryImage={category.image ?? undefined}
          isEven={index % 2 !== 0}
        />
      ))}
    </div>
  );
};

export default SubcategoryProducts;
