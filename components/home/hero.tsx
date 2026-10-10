"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { cn, getOptimizedImageUrl } from "@/lib/utils";
import FallbackImage from "@/components/ui/fallback-image";

function HeroSkeleton() {
  return (
    <section className="w-full bg-[#F4F4F4] dark:bg-background py-3 md:py-4 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-auto lg:h-[320px] xl:h-[400px]">
          {/* Left: Main Slider Skeleton */}
          <div className="lg:col-span-2 relative w-full h-55 sm:h-100 lg:h-full rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-muted-foreground/10 to-muted-foreground/5" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="h-3 w-24 bg-muted-foreground/20 rounded-full" />
              <div className="h-10 w-64 bg-muted-foreground/20 rounded-lg" />
              <div className="h-10 w-48 bg-muted-foreground/20 rounded-lg" />
              <div className="h-12 w-40 bg-muted-foreground/20 rounded-full mt-4" />
            </div>
            {/* Navigation arrows placeholder */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-muted-foreground/10 hidden sm:block" />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-muted-foreground/10 hidden sm:block" />
            {/* Indicators placeholder */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <div className="h-1.5 w-8 bg-muted-foreground/20 rounded-full" />
              <div className="h-1.5 w-1.5 bg-muted-foreground/20 rounded-full" />
              <div className="h-1.5 w-1.5 bg-muted-foreground/20 rounded-full" />
            </div>
          </div>

          {/* Right: Stacked Banners Skeleton */}
          <div className="lg:col-span-1 hidden md:flex flex-col gap-4 h-full w-full">
            <div className="relative flex-1 h-[160px] lg:h-1/2 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-t from-muted-foreground/10 to-transparent" />
              <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                <div className="h-2 w-16 bg-muted-foreground/20 rounded-full" />
                <div className="h-6 w-40 bg-muted-foreground/20 rounded" />
                <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
              </div>
            </div>
            <div className="relative flex-1 h-[160px] lg:h-1/2 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-t from-muted-foreground/10 to-transparent" />
              <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                <div className="h-2 w-20 bg-muted-foreground/20 rounded-full" />
                <div className="h-6 w-48 bg-muted-foreground/20 rounded" />
                <div className="h-3 w-20 bg-muted-foreground/20 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero() {
  const {
    settings,
    heroTitle,
    heroSubtitle,
    heroCtaText,
    heroCtaLink,
    heroSlides,
    promoBanners,
    isLoading,
  } = useWebsiteSettings();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const slideCount = heroSlides?.length ?? 0;
  // Drag tracking lives in a ref, not state — it changes on every pointermove
  // and doesn't need to trigger a re-render, only the final swipe decision
  // (made in onPointerUp) does.
  const dragStartX = React.useRef<number | null>(null);

  // Hooks must run on every render — keep them above the early returns.
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (slideCount === 0 || isDragging) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [nextSlide, slideCount, isDragging]);

  // Swipe-to-navigate: the slides themselves crossfade rather than track the
  // finger 1:1, so this reads the drag as a gesture (distance past a
  // threshold) rather than animating a live offset.
  const SWIPE_THRESHOLD = 50;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    setIsDragging(false);
    if (Math.abs(delta) < SWIPE_THRESHOLD || slideCount < 2) return;
    if (delta < 0) {
      nextSlide();
    } else {
      prevSlide();
    }
  };

  const handlePointerCancel = () => {
    dragStartX.current = null;
    setIsDragging(false);
  };

  const hasSettings = Boolean(
    settings &&
    typeof settings === "object" &&
    Object.keys(settings).length > 0
  );

  if (isLoading || !hasSettings) {
    return <HeroSkeleton />;
  }

  if (!heroSlides || heroSlides.length === 0) {
    return null;
  }

  // A missing/empty promo-banner list only affects the right-hand stacked
  // column (see below) — it used to null out the whole hero, collapsing the
  // skeleton's full height to 0 and shifting every section below it even
  // though the main slider still has real content to show.
  const banners = promoBanners || [];

  const slideData = heroSlides.map((slide, index) => {
    if (index === 0) {
      return {
        ...slide,
        title: heroTitle || slide.title,
        heading: heroSubtitle || slide.heading,
        link: heroCtaLink || slide.link,
      };
    }
    return slide;
  });

  return (
    <section className="w-full bg-[#F4F4F4] dark:bg-background py-3 md:py-4 relative overflow-hidden animate-in fade-in duration-300">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-auto lg:h-[320px] xl:h-[400px]">
          {/* Left: Main Slider (Carousel) */}
          <div
            className={`lg:col-span-2 relative w-full h-55 sm:h-100 lg:h-full rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] group touch-pan-y select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDragStart={(e) => e.preventDefault()}
          >
            {/* Slides */}
            {slideData.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
              >
                <FallbackImage
                  loader={({ src, width }) => getOptimizedImageUrl(src, width)}
                  src={slide.image}
                  alt={slide.heading}
                  fill
                  draggable={false}
                  // The slider sits in the px-4 container, so a phone's slot is
                  // 100vw - 32px; plain 100vw had DPR ~3 phones fetch 1920w.
                  sizes="(max-width: 1023px) calc(100vw - 32px), 66vw"
                  quality={65}
                  // The first slide is the LCP. `priority` alone sets eager
                  // loading + a preload + fetchpriority="high"; do NOT also pass
                  // a `loading` prop — it silently strips fetchpriority="high"
                  // and de-prioritizes the LCP image. The other slides start at
                  // opacity 0, so leaving them non-priority (default lazy) keeps
                  // bandwidth on the one that paints first.
                  priority={index === 0}
                  {...({ fetchPriority: index === 0 ? "high" : "low" } as {
                    fetchPriority: "high" | "low";
                  })}
                  className="object-cover transition-transform duration-[15000ms] ease-linear scale-100 group-hover:scale-110"
                />
              </div>
            ))}

            {/* Premium Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-white hover:text-foreground transition-all duration-300 focus:outline-none hidden sm:flex -translate-x-4 group-hover:translate-x-0 shadow-lg cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2]" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-12 w-12 rounded-full bg-white/10 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-white hover:text-foreground transition-all duration-300 focus:outline-none hidden sm:flex translate-x-4 group-hover:translate-x-0 shadow-lg cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6 stroke-[2]" />
            </button>

            {/* CTA Button — iOS-style liquid glass: no hard border line (that
                read as a "ring" rather than glass). The edge instead comes
                from a soft inset rim — a bright highlight along the top and
                a faint dark line along the bottom, like light catching a
                curved glass surface — plus backdrop-saturate for the
                vibrancy effect iOS glass has over photos. Follows the
                current slide's own link, falling back to the site-wide
                hero_cta_link/hero_cta_text settings. */}
            <Link
              href={slideData[currentSlide]?.link || heroCtaLink}
              className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/15 text-white px-4 py-2 text-xs font-semibold backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-1px_1px_rgba(0,0,0,0.08),0_8px_20px_rgba(0,0,0,0.16)] transition-all duration-300 hover:bg-white/25 hover:scale-105 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_1px_rgba(0,0,0,0.1),0_10px_24px_rgba(0,0,0,0.2)] active:scale-95 cursor-pointer"
            >
              {heroCtaText}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {slideData.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white px-1.5 py-1 drop-shadow-[0px_1px_7.5px_rgba(0,0,0,0.1)] sm:bottom-5">
                {slideData.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      index === currentSlide
                        ? "bg-primary w-5"
                        : "bg-secondary w-2",
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Stacked Banners */}
          <div className="lg:col-span-1 hidden md:flex flex-col gap-4 h-full w-full">
            {banners.map((banner) => (
              <Link
                key={banner.id}
                href={banner.link}
                className="relative flex-1 h-[160px] lg:h-1/2 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all duration-500 group border border-slate-100 dark:border-slate-800"
              >
                <FallbackImage
                  src={getOptimizedImageUrl(banner.image, 600)}
                  alt={banner.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  quality={65}
                  loading="lazy"
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end opacity-90 group-hover:opacity-100 transition-opacity">
                  <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    {/* <p className="text-[10px] uppercase tracking-[0.2em] text-white/90 font-bold mb-1.5 flex items-center gap-2">
                      <span className="h-px w-4 bg-white/90"></span>
                      {banner.subtitle}
                    </p> */}
                    {/* <p className="text-2xl font-heading font-medium text-white leading-tight mb-2">
                      {banner.title}
                    </p> */}
                    <div className="flex items-center text-[11px] uppercase tracking-wider font-bold text-white group-hover:text-primary-foreground transition-colors">
                      {banner.linkText}{" "}
                      <ArrowRight className="h-3 w-3 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
