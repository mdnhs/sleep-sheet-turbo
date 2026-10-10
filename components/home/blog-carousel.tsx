"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, User, BookOpen } from "lucide-react";
import { useGetPosts } from "@/features/blog/api/use-get-posts";
import { formatDate, getOptimizedImageUrl } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";
import FallbackImage from "@/components/ui/fallback-image";

export default function BlogCarousel() {
  const { data: postsData, isLoading } = useGetPosts({ limit: "10" });

  const publishedPosts = postsData?.data?.filter((post) => post.isPublished !== false) || [];

  if (isLoading) {
    // Same section/container/header classes and the same Carousel gutters and
    // item widths as the real render below; the card mirrors its p-5 /
    // space-y-3 details block (2-line title, 2-line summary, footer row).
    return (
      <section className="py-5 md:py-8 bg-[#F4F4F4] dark:bg-background border-t border-slate-100 dark:border-slate-800" aria-hidden="true">
        <div className="container mx-auto px-4">
          <div className="flex flex-row items-end justify-between mb-4 md:mb-6">
            <div>
              <Skeleton className="mb-2 h-6 w-44 rounded-full" />
              <Skeleton className="h-8 w-64 rounded-xl md:h-9" />
            </div>
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <div className="w-full overflow-hidden">
            <div className="-ml-3 flex md:-ml-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`min-w-0 shrink-0 grow-0 pl-3 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 ${i === 1 ? "hidden sm:block" : ""} ${i === 2 ? "hidden lg:block" : ""}`}
                >
                  <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white dark:bg-card">
                    <Skeleton className="aspect-[1200/630] w-full rounded-none" />
                    <div className="flex flex-1 flex-col justify-between space-y-3 p-5">
                      <div className="space-y-2">
                        <div className="flex h-[2.75em] flex-col justify-center gap-1.5 text-base sm:text-lg">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                        <div className="flex h-[3.25em] flex-col justify-center gap-1.5 text-xs">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800/80">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (publishedPosts.length === 0) {
    return null;
  }

  return (
    <section className="py-5 md:py-8 bg-[#F4F4F4] dark:bg-muted/20 border-t border-slate-100 dark:border-slate-800/80">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-4 md:mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full mb-2">
              <BookOpen className="h-3 w-3" />
              Sleep Journal & Guides
            </span>
            <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Latest News & Articles
            </h2>
          </div>
          <Link
            href="/blog"
            className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Carousel */}
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: 4500,
              stopOnInteraction: true,
            }),
          ]}
          className="w-full relative group/carousel"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {publishedPosts.map((post) => (
              <CarouselItem
                key={post.id}
                className="pl-3 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
              >
                <Link
                  href={`/blog/${post.slug || post.id}`}
                  className="group flex flex-col h-full rounded-3xl bg-white dark:bg-card overflow-hidden hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-[1200/630] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <FallbackImage
                      src={post.coverImage ? getOptimizedImageUrl(post.coverImage, 800) : "/placeholder.jpg"}
                      alt={post.coverImage ? post.title : ""}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      quality={75}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {post.createdAt && (
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                        <Calendar className="h-3 w-3 text-indigo-400" />
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Post Details */}
                  <div className="p-5 flex flex-col flex-1 justify-between space-y-3">
                    <div className="space-y-2">
                      <h3 className="font-heading text-base sm:text-lg font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                        {post.title}
                      </h3>
                      {post.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {post.summary}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-medium">
                      {post.author?.name ? (
                        <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{post.author.name}</span>
                        </span>
                      ) : (
                        <span>Read article</span>
                      )}
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                        Read More
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Navigation Controls */}
          <div className="hidden sm:block">
            <CarouselPrevious className="-left-4 lg:-left-5 h-9 w-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
            <CarouselNext className="-right-4 lg:-right-5 h-9 w-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
          </div>
        </Carousel>
      </div>
    </section>
  );
}
