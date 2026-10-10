// A day, like the rest of the storefront. The list is read through a cached
// helper tagged "testimonials", and every write route now invalidates that
// tag, so an edit shows up immediately — the timer is only the fallback for
// changes that bypass those routes.
export const revalidate = 86400;

import { Suspense } from "react";
import TestimonialsClientPage from "./testimonials-client";
import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { getPublicTestimonials } from "@/lib/prefetch-home";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Customer Reviews",
    description: `Real reviews from ${store.name} customers — see what people are saying about our comforter sets, bed sheets, and pillow covers.`,
    canonical: `${seoConfig.siteUrl}/testimonials`,
  }));

// Mirrors TestimonialsClientPage: breadcrumb row (text-xs + mb-6), centered
// heading block (text-4xl/md:text-5xl title + mb-4, text-lg subtitle, mb-10)
// and the same responsive grid/gap with aspect-[9/16] cards.
function TestimonialsFallback() {
  return (
    <div className="container mx-auto py-12 px-4 min-h-[60vh]" aria-hidden="true">
      <div className="flex h-4 items-center gap-2 mb-6">
        <div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        <span className="text-border text-xs">•</span>
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
      </div>
      <div className="text-center mb-10">
        <div className="mb-4 flex h-10 md:h-12 justify-center">
          <div className="h-full w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
        </div>
        <div className="flex h-7 justify-center">
          <div className="h-5 w-80 max-w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg self-center" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[9/16] bg-gray-200 dark:bg-gray-700 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function TestimonialsPage() {
  const store = await getStoreProfile();
  const testimonialsRes = await getPublicTestimonials().catch(() => null);
  const testimonials = testimonialsRes?.data || [];

  return (
    <>
      {structuredDataScript("testimonials-listing", webpageSchema(
        `Customer Reviews | ${store.name}`,
        `Real reviews from ${store.name} customers.`,
        `${seoConfig.siteUrl}/testimonials`,
        store,
      ))}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Reviews", url: "/testimonials" },
        ]),
      )}
      <Suspense fallback={<TestimonialsFallback />}>
        <TestimonialsClientPage
          initialTestimonials={testimonials}
          initialHasNextPage={testimonialsRes?.hasNextPage ?? false}
          initialTotal={testimonialsRes?.total ?? 0}
        />
      </Suspense>
    </>
  );
}
