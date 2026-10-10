"use client";

import React, { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useQueryState } from "nuqs";
import Link from "next/link";
import ProductVideoCard from "@/components/product/product-video-card";
import ReelsViewer, { useWarmReelsViewer } from "@/components/product/lazy-reels-viewer";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import type { ProductVideoItem } from "@/lib/types";

// A card has to be at least this visible to be a candidate for playing.
const MIN_RATIO = 0.6;

export default function VideosGrid({ items }: { items: ProductVideoItem[] }) {
  const { t, language } = useLanguage();
  const ratios = useRef(new Map<string, number>());
  useWarmReelsViewer();
  const [activeId, setActiveId] = useState<string | null>(null);
  // The open video lives in the URL (?v=<slug>), so every video has its own
  // shareable address and the browser's back button closes the viewer. The
  // viewer itself renders only in the browser (it portals into document.body).
  const [videoSlug, setVideoSlug] = useQueryState("v");
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const found = videoSlug ? items.findIndex((item) => item.slug === videoSlug) : -1;
  const openIndex = isClient && found >= 0 ? found : null;
  // Opening pushes a history entry; closing goes back over it when we pushed
  // one (so "back" and "close" are the same thing), else just clears the param.
  const pushed = useRef(false);

  const openViewer = useCallback(
    (index: number) => {
      pushed.current = true;
      void setVideoSlug(items[index].slug, { history: "push" });
    },
    [items, setVideoSlug],
  );
  const closeViewer = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      void setVideoSlug(null, { history: "replace" });
    }
  }, [setVideoSlug]);
  const onActiveChange = useCallback(
    (index: number) => void setVideoSlug(items[index].slug, { history: "replace" }),
    [items, setVideoSlug],
  );

  const openViewerHandlers = useRef<Map<number, () => void>>(new Map());
  const getOpenViewer = useCallback(
    (index: number) => {
      let handler = openViewerHandlers.current.get(index);
      if (!handler) {
        handler = () => openViewer(index);
        openViewerHandlers.current.set(index, handler);
      }
      return handler;
    },
    [openViewer]
  );

  // Only ONE video plays at a time: whichever card is most on screen. A grid
  // of autoplaying videos would otherwise decode half a dozen at once.
  const onVisibleRatio = useCallback((id: string, ratio: number) => {
    ratios.current.set(id, ratio);
    let best: string | null = null;
    let bestRatio = MIN_RATIO - 0.0001;
    for (const [key, value] of ratios.current) {
      if (value > bestRatio) {
        best = key;
        bestRatio = value;
      }
    }
    setActiveId((prev) => (prev === best ? prev : best));
  }, []);

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
          <span className="text-border">•</span>
          <span className="text-foreground" aria-current="page">{t("videosPageTitle")}</span>
        </nav>

        <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
          {t("videosPageTitle")}
        </h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground max-w-2xl" lang={language}>
          {t("videosPageDesc")}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-muted-foreground">{t("videosEmpty")}</p>
            <Button nativeButton={false} render={<Link href="/shop" />} className="rounded-full">
              {t("browseShop")}
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 list-none p-0 m-0">
            {items.map((item, index) => (
              <li key={item.id}>
                <ProductVideoCard
                  item={item}
                  active={openIndex === null && activeId === item.id}
                  onVisibleRatio={onVisibleRatio}
                  onOpen={getOpenViewer(index)}
                  paused={openIndex !== null}
                  priority={index < 2}
                />
                {/* A real, descriptive link to each product (the card's own
                    Order Now button says nothing about what it opens). */}
                <h2 className="mt-2 px-0.5 text-sm font-medium leading-snug text-foreground">
                  <Link href={`/shop/${item.slug}`} className="line-clamp-2 hover:text-primary hover:underline underline-offset-4">
                    {item.name}
                  </Link>
                </h2>
              </li>
            ))}
          </ul>
        )}
      </div>
      {openIndex !== null && (
        <ReelsViewer
          items={items}
          startIndex={openIndex}
          onClose={closeViewer}
          onActiveChange={onActiveChange}
          manageHistory={false}
        />
      )}
    </div>
  );
}
