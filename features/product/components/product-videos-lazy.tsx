"use client";

import dynamic from "next/dynamic";
import { WhenVisible } from "@/components/when-visible";
import type { ProductVideoItem } from "@/lib/types";

// The product page's "other videos" carousel sits below the first screen on
// a phone, but rendered with the page it hydrated with it (a dozen cards, an
// embla carousel, an IntersectionObserver per card) and — since Chrome starts
// lazy images up to 1250-2500px from the viewport — still fetched most of
// its posters during the initial load. Now neither its code nor its posters
// load until the visitor scrolls near it. Its content is other products'
// videos, so leaving it out of the server HTML costs no SEO; this product's
// own video stays in the gallery and its VideoObject JSON-LD.
const ProductVideos = dynamic(() => import("@/components/home/product-videos"), {
  ssr: false,
  loading: () => <EmbeddedVideosPlaceholder />,
});

// Mirrors ProductVideos' embedded layout (components/home/product-videos.tsx):
// the white card with p-3/sm:p-4, the header row, slides at basis-[46%] /
// sm:basis-[34%] with a pl-3 gutter and aspect-[9/16] cards, and the md+
// arrow row (mt-4 + h-10), so swapping it for the real section shifts nothing.
function EmbeddedVideosPlaceholder() {
  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl bg-white p-3 sm:p-4 dark:bg-slate-900"
    >
      <div className="mb-3 md:mb-4 flex flex-row items-end justify-between">
        <div className="h-6 sm:h-7 w-32 rounded bg-muted/60 animate-pulse" />
        <div className="h-4 w-16 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="overflow-hidden">
        <div className="-ml-3 flex">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 pl-3 basis-[46%] sm:basis-[34%]">
              <div className="aspect-[9/16] w-full rounded-2xl bg-muted/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden md:block mt-4 h-10" />
    </section>
  );
}

export default function ProductVideosLazy({ items }: { items: ProductVideoItem[] }) {
  return (
    <WhenVisible placeholder={<EmbeddedVideosPlaceholder />}>
      <ProductVideos items={items} embedded />
    </WhenVisible>
  );
}
