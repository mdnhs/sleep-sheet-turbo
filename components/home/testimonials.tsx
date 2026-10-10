"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useGetTestimonials } from "@/features/testimonials/api/use-get-testimonials";
import { Star, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import { getOptimizedImageUrl } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import FallbackImage from "@/components/ui/fallback-image";

// Same lightbox used for product image galleries — loaded on demand so it
// stays out of the homepage's initial bundle.
const ProductLightbox = dynamic(
  () => import("@/features/product/components/product-lightbox"),
  { ssr: false }
);

const Testimonials = () => {
  const { data } = useGetTestimonials();
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxMounted, setLightboxMounted] = useState(false);

  const screenshotTestimonials = (data?.data || []).filter((t) => t.screenshot);
  const screenshotIndexById = new Map(
    screenshotTestimonials.map((t, i) => [t.id, i])
  );

  const openLightbox = (id: string) => {
    const index = screenshotIndexById.get(id);
    if (index === undefined) return;
    setLightboxMounted(true);
    setLightboxIndex(index);
  };

  return (
    <section className="py-4 md:py-6 bg-background border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
      <div className="container mx-auto px-4">
        {/* Minimal Section header */}
        <div className="flex flex-row items-end justify-between mb-3 md:mb-4">
          <h2 className="font-heading text-xl md:text-2xl font-medium text-foreground tracking-tight">
            Customer Reviews
          </h2>
          <Link
            href="/testimonials"
            className="group flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Show More
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {data?.data && data.data.length > 0 ? (
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 4000,
                stopOnInteraction: true,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {data.data.map((testimonial, index: number) => (
                <CarouselItem key={index} className="pl-4 basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  {testimonial.screenshot ? (
                    <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden border border-border/50 group cursor-grab active:cursor-grabbing bg-muted shadow-sm hover:shadow-md transition-shadow">
                      <button
                        type="button"
                        onClick={() => openLightbox(testimonial.id)}
                        className="absolute inset-0 cursor-zoom-in"
                        aria-label={`View full review image from ${testimonial.name}`}
                      >
                        <FallbackImage
                          src={getOptimizedImageUrl(testimonial.screenshot, 300)}
                          alt={`Review from ${testimonial.name}`}
                          fill
                          sizes="(max-width: 640px) 75vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          quality={65}
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-white/20 bg-secondary overflow-hidden shrink-0">
                            <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${testimonial.name || 'User'}`} />
                            <AvatarFallback className="text-xs bg-white text-black">
                              {(testimonial.name || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            {testimonial.name && (
                              <p className="font-medium text-sm text-white truncate drop-shadow-md">
                                {testimonial.name}
                              </p>
                            )}
                            <div className="flex items-center gap-0.5 mt-0.5 drop-shadow-md">
                              {Array.from({ length: testimonial.rating }).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary/30 p-6 flex flex-col h-full rounded-2xl border border-border/50 aspect-[9/16]">
                      <div className="flex-1">
                        <span className="font-heading text-5xl leading-none text-primary/20 select-none">
                          &ldquo;
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-[8] mt-2">
                          {testimonial.message}
                        </p>
                      </div>
                      <div className="pt-4 mt-4 border-t border-border flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0 bg-secondary overflow-hidden">
                          <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${testimonial.name || 'User'}`} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(testimonial.name || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{testimonial.name}</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {Array.from({ length: testimonial.rating }).map((_, i) => (
                              <Star key={i} className="h-2.5 w-2.5 fill-primary text-primary" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden md:flex items-center justify-end gap-2 mt-6">
              <CarouselPrevious className="relative inset-0 translate-y-0 h-8 w-8 bg-background border-border hover:bg-secondary hover:text-foreground" />
              <CarouselNext className="relative inset-0 translate-y-0 h-8 w-8 bg-background border-border hover:bg-secondary hover:text-foreground" />
            </div>
          </Carousel>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No reviews yet.
          </div>
        )}
      </div>

      {lightboxMounted && (
        <ProductLightbox
          index={lightboxIndex}
          slides={screenshotTestimonials.map((t) => ({
            src: t.screenshot as string,
            title: t.name || "Customer Review",
            description: t.message || `${t.rating} star review`,
          }))}
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
        />
      )}
    </section>
  );
};

export default Testimonials;
