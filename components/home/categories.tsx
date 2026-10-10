"use client";

import { useGetCategory, type PublicCategory } from "@/features/categories/api/use-get-category";
import Link from "next/link";
import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoriesProps {
  initialData?: PublicCategory[];
}

// Dye-lot swatch palette — the chips read as fabric-color cards (this is a
// bedding store) rather than the generic cream/terracotta AI default.
// Each entry is a saturated diagonal gradient (not a flat fill), so the row
// reads as vivid dye swatches rather than muted paint chips. Cycled by
// position. Text is white across every swatch (a drop-shadow on the text
// itself, applied where it's rendered, keeps it legible even on the
// lighter amber/rose ones) instead of switching to dark text per-swatch.
const SWATCHES = [
  { from: "#F0264F", to: "#A10E33" }, // Cranberry
  { from: "#A34BC7", to: "#5B1F7A" }, // Vivid plum
  { from: "#FFB020", to: "#B85E0A" }, // Amber gold — darker "to" stop than the others so white text still has somewhere to land
  { from: "#17C3B2", to: "#0A7A70" }, // Vivid teal
  { from: "#FF6FA5", to: "#B8245A" }, // Hot rose — darkened "to" stop, same reason as amber
  { from: "#5B7CFA", to: "#2E3FA8" }, // Royal indigo
];

const Categories = ({ initialData }: CategoriesProps) => {
  const { data, isLoading } = useGetCategory();

  const displayedCategories = (data?.categories && data.categories.length > 0)
    ? data.categories
    : initialData || [];

  if (isLoading && displayedCategories.length === 0) {
    return (
      <section className="py-3 md:py-5 bg-[#F4F4F4] dark:bg-transparent relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          {/* Same max-w-7xl wrapper and 8px/12px item gutter as the Carousel below. */}
          <div className="mx-auto w-full max-w-7xl overflow-hidden">
            <div className="flex gap-2 md:gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-23 w-33 shrink-0 rounded-[20px]" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-3 md:py-5 bg-[#F4F4F4] dark:bg-transparent relative overflow-hidden">
      <div className="container mx-auto px-4 relative">
        <Carousel
          opts={{
            align: "start",
            dragFree: true,
          }}
          className="w-full max-w-7xl mx-auto"
        >
          <CarouselContent className="-ml-2 md:-ml-3">
            {displayedCategories?.map((category, index) => {
              const swatch = SWATCHES[index % SWATCHES.length];
              return (
                <CarouselItem
                  key={category?.value}
                  className="pl-2 md:pl-3 basis-auto"
                >
                  <Link
                    href={`/categories/${category?.value}`}
                    className="group relative flex min-w-32 max-w-42 shrink-0 flex-col justify-between gap-4 overflow-hidden rounded-[20px] px-4 py-3.5 transition-transform duration-300 hover:-translate-y-1"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${swatch.from}, ${swatch.to})`,
                    }}
                  >
                    {/* Glossy sheen — reads as dyed fabric catching light, not a flat paint chip */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -left-6 -top-10 h-24 w-24 rotate-12 rounded-full bg-white/25 blur-xl"
                    />
                    {/* Folded-corner cue — a swatch card, not a photo frame */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 bg-black/20"
                      style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }}
                    />
                    <span className="relative font-heading text-sm font-semibold leading-snug text-white">
                      {category?.label}
                    </span>
                    <div className="relative flex items-center border-t border-dashed border-white/25 pt-2 text-[11px] text-white/85">
                      <span>{category?.productCount ?? 0} pieces</span>
                    </div>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <div className="hidden md:block">
            <CarouselPrevious className="-left-4 lg:-left-12 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
            <CarouselNext className="-right-4 lg:-right-12 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default Categories;
