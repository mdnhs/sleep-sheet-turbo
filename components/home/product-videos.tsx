"use client";

import React, { startTransition, useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useLanguage } from "@/hooks/use-language";
import ProductVideoCard from "@/components/product/product-video-card";
import ReelsViewer, { useWarmReelsViewer } from "@/components/product/lazy-reels-viewer";
import type { ProductVideoItem } from "@/lib/types";
import { afterNextPaint } from "@/lib/after-next-paint";

interface ProductVideosProps {
  items: ProductVideoItem[];
  /**
   * Sits inside another layout (the product page's details column) instead of
   * being a full-width landing-page section: no page background or container,
   * a white card like its neighbours, and slides sized for the narrower column.
   */
  embedded?: boolean;
}

export default function ProductVideos({ items, embedded = false }: ProductVideosProps) {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useWarmReelsViewer();
  const closeViewer = useCallback(() => setOpenIndex(null), []);
  if (items.length === 0) return null;

  // Landing page: 2 across on a phone up to 5 on desktop. Embedded in the
  // product page's column (about half the width on desktop): 2 on a phone, 3 beside the details.
  const slideClass = embedded
    ? "pl-3 basis-[46%] sm:basis-[34%]"
    : "pl-3 md:pl-4 basis-[46%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5";

  return (
    <section
      className={
        embedded
          ? "relative overflow-hidden rounded-2xl bg-white p-3 sm:p-4 dark:bg-slate-900"
          : "py-4 md:py-6 bg-[#F4F4F4] dark:bg-background relative overflow-hidden"
      }
    >
      <div className={embedded ? "relative" : "container mx-auto px-4 relative"}>
        <div className="mb-3 md:mb-4 flex flex-row items-end justify-between">
          <h2
            className={
              embedded
                ? "font-heading text-base sm:text-lg font-semibold text-foreground tracking-tight"
                : "font-heading text-xl md:text-2xl font-medium text-foreground tracking-tight"
            }
          >
            {t("watchAndShop")}
          </h2>
          <Link
            href="/videos"
            aria-label={t("showMore")}
            className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            <span>{t("showMore")}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className={embedded ? "-ml-3" : "-ml-3 md:-ml-4"}>
            {items.map((item, index) => (
              <CarouselItem
                key={item.id}
                className={slideClass}
              >
                <ProductVideoCard
                  item={item}
                  // After the tap has painted, and as a transition: a
                  // transition alone only splits the render — mounting the
                  // full-screen viewer (portal, scroll position, focus, body
                  // overflow) still committed in one block before that paint,
                  // a 544 ms P75 tap on phones.
                  onOpen={() => afterNextPaint(() => startTransition(() => setOpenIndex(index)))}
                  paused={openIndex !== null}
                />
              </CarouselItem>
            ))}
            {/* Last slide: the way into the full video page. */}
            <CarouselItem className={slideClass}>
              <Link
                href="/videos"
                className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] p-4 text-center text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold sm:text-base">{t("showMore")}</span>
              </Link>
            </CarouselItem>
          </CarouselContent>
          <div className="hidden md:flex items-center justify-end gap-2 mt-4">
            <CarouselPrevious className="relative inset-0 translate-y-0 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
            <CarouselNext className="relative inset-0 translate-y-0 h-10 w-10 border-border/50 bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:bg-white hover:text-primary transition-all shadow-sm" />
          </div>
        </Carousel>
      </div>
      {openIndex !== null && (
        <ReelsViewer items={items} startIndex={openIndex} onClose={closeViewer} />
      )}
    </section>
  );
}
