"use client";
import React from "react";
import { Button } from "../ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "../product/product-card";
import { useGetProducts } from "@/features/product/api/use-get-products";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCarouselSkeleton } from "@/components/product/product-card-skeleton";
import type { ProductSummary } from "@/lib/types";

interface FeaturedProductProps {
  initialData?: ProductSummary[];
}

const FeaturedProduct = ({ initialData }: FeaturedProductProps) => {
  const { data: products, isLoading } = useGetProducts({
    sort: "newest",
  });

  const productList = (products?.data && products.data.length > 0)
    ? products.data
    : initialData || [];

  if (isLoading && productList.length === 0) {
    return (
      <section className="py-4 md:py-6 bg-[#F4F4F4] dark:bg-background border-t border-slate-100 dark:border-slate-800 relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-row items-end justify-between mb-3 md:mb-4">
            <div>
              <h2 className="font-heading text-xl md:text-2xl font-medium text-foreground tracking-tight">
                New Arrivals
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="hidden sm:inline">View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <ProductCarouselSkeleton />
        </div>
      </section>
    );
  }

  if (productList.length === 0) {
    return null;
  }

  return (
    <section className="py-4 md:py-6 bg-[#F4F4F4] dark:bg-background border-t border-slate-100 dark:border-slate-800 relative overflow-hidden">
      <div className="container mx-auto px-4 relative">
        {/* Minimal Section header */}
        <div className="flex flex-row items-end justify-between mb-3 md:mb-4">
          <div>
            <h2 className="font-heading text-xl md:text-2xl font-medium text-foreground tracking-tight">
              New Arrivals
            </h2>
          </div>
          <Link
            href="/shop?sort=newest"
            aria-label="View all new arrivals"
            className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="hidden sm:inline">View All</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <Carousel
          opts={{
            align: "start",
            dragFree: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-6">
            {productList.map((product) => (
              <CarouselItem key={product.id} className="pl-3 md:pl-6 basis-[58%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                <div className="h-full py-1.5 md:py-2">
                  <ProductCard product={product} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden md:flex items-center justify-end gap-2 mt-4">
            <CarouselPrevious className="relative inset-0 translate-y-0 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
            <CarouselNext className="relative inset-0 translate-y-0 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default FeaturedProduct;
