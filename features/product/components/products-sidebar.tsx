"use client";
import CategoryLoading from "@/components/loading/category-loading";
import { Button } from "@/components/ui/button";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useCurrency } from "@/hooks/use-currency";
import { Funnel, RefreshCcw } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryState } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";





export function MobileFilterSheet({ side = "bottom", initialCategory }: { side?: "bottom" | "left" | "right"; initialCategory?: string }) {
  const [category] = useQueryState("category", { defaultValue: initialCategory || "", shallow: false });
  const [price] = useQueryState("price", { defaultValue: "", shallow: false });
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const activeCategory = category || "All";
  const selectedPrice = price || null;

  return (
    <div className="lg:hidden">
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        {/* Floating like the WhatsApp/scroll-to-top buttons in client-layout.tsx,
            stacked one level above those — the inline row this used to sit in
            (with its own border and padding) is gone entirely; see
            product-contents.tsx. z-45 (not z-40): ProductCard's own "Buy Now"
            button (components/product/product-card.tsx) sits in a `relative
            z-40` wrapper, and since it renders later in the DOM than this
            fixed button, an equal z-index let it paint on top whenever a
            card scrolled into this button's spot. Background matches the
            bottom nav's Shop button — see components/nav-bar.tsx. */}
        <SheetTrigger
          render={
            <Button
              size="icon"
              id="shop-filter-trigger"
              className="fixed bottom-34 sm:bottom-20 right-4 sm:right-6 z-[45] h-12 w-12 rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white shadow-xl shadow-[#B8245A]/30 transition-all duration-300 hover:scale-110 active:scale-95"
              aria-label="Open filters"
            />
          }
        >
          <Funnel className="h-5 w-5" />
          {(activeCategory !== "All" || selectedPrice) && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
              {(activeCategory !== "All" ? 1 : 0) + (selectedPrice ? 1 : 0)}
            </span>
          )}
        </SheetTrigger>
        <SheetContent
          side={side}
          className={side === "bottom"
            // z-[130]: above the fixed bottom nav (z-50 / z-[100]) — at the
            // default z-50 the nav painted over the sheet's bottom edge and
            // hid the "View Results" button.
            ? "z-[130] h-[70vh] data-[side=bottom]:h-[70vh] rounded-t-[2rem] px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            : "w-full sm:max-w-md px-5 py-5"
          }
        >
          {/* SheetHeader's own default is `p-6` (components/ui/sheet.tsx) — px-0
              alone only cancels the horizontal half via tailwind-merge, leaving
              its 24px top/bottom padding in place. p-0 clears all of it so mb-2
              is the only space left below the title. */}
          <SheetHeader className="p-0 mb-2 text-left">
            <SheetTitle className="font-heading text-2xl font-semibold">Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 min-h-0 pb-0 no-scrollbar">
            <ProductSidebarContent initialCategory={initialCategory} />

            <div className="sticky bottom-0 mt-4 pt-3 pb-4 bg-background border-t border-border/50">
              <Button
                className="w-full h-14 rounded-full text-base font-semibold shadow-xl shadow-foreground/10"
                onClick={() => setIsSheetOpen(false)}
              >
                View Results
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ProductSidebarContent({ initialCategory }: { initialCategory?: string } = {}) {
  const { symbol } = useCurrency();

  // URL States
  const [categoryParam, setCategoryParam] = useQueryState("category", { defaultValue: initialCategory || "", shallow: false });
  const [minPrice, setMinPrice] = useQueryState("minPrice", { defaultValue: "", shallow: false });
  const [maxPrice, setMaxPrice] = useQueryState("maxPrice", { defaultValue: "", shallow: false });
  
  // Local states
  const [localPrice, setLocalPrice] = useState<number[]>([
    minPrice ? parseInt(minPrice) : 0, 
    maxPrice ? parseInt(maxPrice) : 5000
  ]);

  const { data: categories = [], isLoading: isCategoryListLoading } = useGetCategories();

  const selectedCategories = categoryParam ? categoryParam.split(",").filter(Boolean) : [];

  // Update slider local state, debounce URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinPrice(localPrice[0] > 0 ? localPrice[0].toString() : null);
      setMaxPrice(localPrice[1] < 5000 ? localPrice[1].toString() : null);
    }, 500);
    return () => clearTimeout(timer);
  }, [localPrice, setMinPrice, setMaxPrice]);

  const toggleCategory = (label: string) => {
    const newCategories = selectedCategories.includes(label)
      ? selectedCategories.filter(c => c !== label)
      : [...selectedCategories, label];
    
    setCategoryParam(newCategories.length > 0 ? newCategories.join(",") : null);
  };

  const handleResetCategories = () => {
    setCategoryParam(null);
  };

  const parentCategories = categories.filter(c => !c.parentId);

  return (
    <div className="space-y-3">
      {/* Price Range */}
      <div>
        <h3 className="font-heading font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
          <span className="text-muted-foreground">{symbol}</span> Price Range
        </h3>
        <div className="px-2">
          <Slider
            min={0}
            max={5000}
            step={50}
            value={localPrice}
            onValueChange={(val) => setLocalPrice(val as number[])}
            className="mb-3"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mt-3">
            <span>{localPrice[0].toLocaleString()} {symbol}</span>
            <span>{localPrice[1].toLocaleString()} {symbol}</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-lg text-foreground flex items-center gap-2">
            <span className="text-muted-foreground rotate-45 text-sm font-light">⬣</span> Categories
          </h3>
          <button 
            onClick={handleResetCategories}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Reset categories"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
        
        {isCategoryListLoading ? (
          <CategoryLoading />
        ) : (
          <div className="flex flex-col gap-3">
            {parentCategories.map((parent) => {
              const children = categories.filter(c => c.parentId === parent.id);
              const parentCount =
                (parent.productCount || 0) +
                children.reduce((sum, child) => sum + (child.productCount || 0), 0);
              return (
                <div key={parent.id} className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={selectedCategories.includes(parent.label)}
                      onCheckedChange={() => toggleCategory(parent.label)}
                      className="border-muted-foreground/30 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500 rounded-sm"
                    />
                    <span className="text-sm font-medium text-foreground group-hover:text-rose-500 transition-colors">
                      {parent.label}
                    </span>
                    <span className="text-xs text-muted-foreground">({parentCount})</span>
                  </label>

                  {children.length > 0 && (
                    <div className="flex flex-col gap-3 pl-7 border-l-2 border-muted/50 ml-2">
                      {children.map(child => (
                        <label key={child.id} className="flex items-center gap-3 cursor-pointer group">
                          <Checkbox
                            checked={selectedCategories.includes(child.label)}
                            onCheckedChange={() => toggleCategory(child.label)}
                            className="border-muted-foreground/30 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500 rounded-sm"
                          />
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            {child.label}
                          </span>
                          <span className="text-xs text-muted-foreground">({child.productCount || 0})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductSidebar({ initialCategory }: { initialCategory?: string } = {}) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 space-y-3 sticky top-20 bg-card rounded-2xl p-3">
      <ProductSidebarContent initialCategory={initialCategory} />
    </aside>
  );
}

// Row heights follow ProductSidebarContent above: h3 = text-lg (28px), slider
// track h-3, text-xs value row, category rows = text-sm (20px) with a 16px
// checkbox and gap-3, reset button = p-1 + 16px icon (24px).
export function ProductSidebarSkeleton() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 space-y-3 sticky top-20 bg-card rounded-2xl p-3" aria-hidden="true">
      {/* Price Range */}
      <div>
        <div className="mb-3 flex h-7 items-center">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="px-2">
          <Skeleton className="mb-3 h-3 w-full rounded-full" />
          <div className="mt-3 flex h-4 items-center justify-between">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div>
        <div className="mb-3 flex h-7 items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <div className="flex flex-col gap-3">
          {["w-2/3", "w-1/2", "w-3/4", "w-1/3", "w-3/5"].map((width, i) => (
            <div key={i} className="flex h-5 items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default ProductSidebar;
