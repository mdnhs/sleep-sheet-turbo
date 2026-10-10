"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Star, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/utils";
import { client } from "@/lib/rpc";
import { useLanguage } from "@/hooks/use-language";
import FallbackImage from "@/components/ui/fallback-image";

// Same lightbox used for product image galleries — loaded on demand so it
// stays out of this page's initial bundle.
const ProductLightbox = dynamic(
  () => import("@/features/product/components/product-lightbox"),
  { ssr: false }
);

interface Testimonial {
  id: string;
  name: string;
  message: string;
  rating: number;
  screenshot: string | null;
  role: string;
  createdAt: string;
}

interface TestimonialsClientProps {
  initialTestimonials: Testimonial[];
  initialHasNextPage: boolean;
  initialTotal: number;
}

function TestimonialCard({
  testimonial,
  onImageClick,
}: {
  testimonial: Testimonial;
  onImageClick: () => void;
}) {
  if (testimonial.screenshot) {
    return (
      <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden border border-border/50 bg-muted shadow-sm hover:shadow-md transition-shadow">
        <button
          type="button"
          onClick={onImageClick}
          className="absolute inset-0 cursor-zoom-in"
          aria-label={`View full review image from ${testimonial.name}`}
        >
          <FallbackImage
            src={getOptimizedImageUrl(testimonial.screenshot, 400)}
            alt={`Review from ${testimonial.name}`}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            quality={70}
            className="object-cover"
          />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-white/20 bg-secondary overflow-hidden shrink-0">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${testimonial.name || "User"}`}
              />
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
    );
  }

  return (
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
          <AvatarImage
            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${testimonial.name || "User"}`}
          />
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
  );
}

export default function TestimonialsClientPage({
  initialTestimonials,
  initialHasNextPage,
  initialTotal,
}: TestimonialsClientProps) {
  const { t } = useLanguage();
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxMounted, setLightboxMounted] = useState(false);

  const screenshotTestimonials = testimonials.filter((t) => t.screenshot);
  const screenshotIndexById = new Map(
    screenshotTestimonials.map((t, i) => [t.id, i])
  );

  const openLightbox = (id: string) => {
    const index = screenshotIndexById.get(id);
    if (index === undefined) return;
    setLightboxMounted(true);
    setLightboxIndex(index);
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await client.api.testimonials.$get({
        query: { page: nextPage.toString(), limit: "12" },
      });
      const json = await response.json();
      if ("data" in json) {
        setTestimonials((prev) => [...prev, ...json.data]);
        setHasNextPage(json.hasNextPage);
        setPage(nextPage);
      }
    } catch {
      // Leave the list as-is; the button stays visible so the user can retry.
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 min-h-[60vh]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-6 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">{t("testimonialsBreadcrumbLabel")}</span>
      </nav>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {t("customerReviews")}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {initialTotal > 0
            ? t("testimonialsSubtitleWithCount").replace("{count}", String(initialTotal))
            : t("testimonialsSubtitleNoCount")}
        </p>
      </div>

      {testimonials.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                testimonial={testimonial}
                onImageClick={() => openLightbox(testimonial.id)}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-10">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("loadMoreReviews")}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {t("noReviewsYet")}
        </div>
      )}

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
    </div>
  );
}
