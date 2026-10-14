"use client";

import React, { memo, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Share2, Zap } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { floorToNearest50 } from "@/lib/utils";
import { productVideoPoster, productVideoSources } from "@/lib/product-video";
import { sendVideoStats } from "@/lib/video-stats";
import BrandedVideoPlayer from "@/components/product/branded-video-player";
import type { ProductVideoItem } from "@/lib/types";

const compactCount = new Intl.NumberFormat("en", { notation: "compact" });

interface ReelSlideProps {
  item: ProductVideoItem;
  /** Slide position in the viewer's list (padding copies included). */
  index: number;
  /** Near the screen: a real player (and the ambient glow) instead of a poster. */
  live: boolean;
  preload: "auto" | "metadata";
  likes: number;
  liked: boolean;
  // The callbacks below must keep one identity for the viewer's lifetime:
  // that is what lets a like, a mute or a swipe re-render only the slides
  // whose own props changed.
  onVideoRef: (index: number, video: HTMLVideoElement | null) => void;
  onDoubleTap: (item: ProductVideoItem, point: { x: number; y: number }) => void;
  onToggleLike: (id: string) => void;
  onShare: (item: ProductVideoItem) => void;
}

/** One screen-high slide of the Reels viewer: the video (or its poster), price, Buy Now, like and share. */
const ReelSlide = memo(function ReelSlide({
  item,
  index,
  live,
  preload,
  likes,
  liked,
  onVideoRef,
  onDoubleTap,
  onToggleLike,
  onShare,
}: ReelSlideProps) {
  const { siteName } = useWebsiteSettings();
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();

  const price = item.colors?.find((c) => c.name === item.defaultVariantName)?.price ?? item.price;
  const original = item.discount > 0 ? floorToNearest50(price / (1 - item.discount / 100)) : null;

  const videoRef = useCallback((video: HTMLVideoElement | null) => onVideoRef(index, video), [onVideoRef, index]);
  const handleDoubleTap = useCallback((point: { x: number; y: number }) => onDoubleTap(item, point), [onDoubleTap, item]);
  const sources = useMemo(() => productVideoSources(item.video), [item.video]);

  return (
    <section
      data-index={index}
      aria-label={item.name}
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center overflow-hidden"
    >
      {/* Ambient glow for screens wider than the 9:16 video — only near
          the screen, as a full-screen blur is costly to keep around. */}
      {live && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={productVideoPoster(item.video, 120)}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-xl"
        />
      )}
      {live ? (
        <BrandedVideoPlayer
          ref={videoRef}
          variant="minimal"
          loop
          preload={preload}
          poster={productVideoPoster(item.video)}
          label={`${item.name} – video`}
          className="max-w-full"
          onDoubleTap={handleDoubleTap}
          sources={sources}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={productVideoPoster(item.video)}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative h-full max-w-full object-contain"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-[28rem] bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-24">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 line-clamp-1 text-sm font-medium text-white/90 drop-shadow">
              {item.name}
            </p>
            <p className="mb-3 flex items-baseline gap-2 text-white drop-shadow">
              <span className="text-xl font-bold">{formatAmount(price)}</span>
              {original && (
                <span className="text-sm font-medium text-white/70 line-through">
                  {formatAmount(original)}
                </span>
              )}
            </p>
            <div className="flex items-center gap-3">
              {/* The brand mark as a round "profile picture", like the
                  account avatar on a Reel, ringed with the same gradient
                  as the Order Now button. The artwork has a wide margin,
                  so it is scaled up inside the circle to fill it. */}
              <span className="shrink-0 rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] p-[2.5px] shadow-lg">
                <span className="relative block h-[43px] w-[43px] overflow-hidden rounded-full bg-[#F9E8E9]">
                  <Image
                    src="/sleep-sheet-logo.jpg"
                    alt={siteName}
                    fill
                    sizes="48px"
                    className="origin-[48%_48%] scale-[1.5] object-cover"
                  />
                </span>
              </span>
              <Link
                href={`/shop/${item.slug}`}
                aria-label={`${t("buyNow")}: ${item.name}`}
                onClick={() => sendVideoStats(item.id, { orderClicks: 1 })}
                className="pointer-events-auto flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Zap className="h-4 w-4 fill-current" aria-hidden />
                {t("buyNow")}
              </Link>
            </div>
          </div>
          {/* Right column, as wide as the round buttons. Bottom to top:
              share, like, then the like total. */}
          <div className="pointer-events-auto mb-0.5 flex w-11 shrink-0 flex-col items-center gap-3 text-white">
            <span className="text-xs font-semibold tabular-nums drop-shadow">
              {compactCount.format(likes)}
            </span>
            <button
              type="button"
              onClick={() => onToggleLike(item.id)}
              aria-pressed={liked}
              aria-label={liked ? t("unlikeVideo") : t("likeVideo")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 transition-transform active:scale-90"
            >
              <Heart className={liked ? "h-6 w-6 fill-[#FF3B7F] text-[#FF3B7F]" : "h-6 w-6"} />
            </button>
            <button
              type="button"
              onClick={() => onShare(item)}
              aria-label={t("shareVideo")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 transition-transform active:scale-90"
            >
              <Share2 className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});

export default ReelSlide;
