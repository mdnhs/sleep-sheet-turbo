"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Volume2, VolumeX, Zap } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { floorToNearest50 } from "@/lib/utils";
import { autoplayAllowed, productVideoPoster, productVideoUrl } from "@/lib/product-video";
import type { ProductVideoItem } from "@/lib/types";

export interface ProductVideoCardProps {
  item: ProductVideoItem;
  /**
   * Controlled mode (the /videos grid): the parent decides which single card
   * plays, so a page full of videos never decodes more than one at a time. The
   * card reports how much of it is on screen through `onVisibleRatio`.
   * Leave undefined (the landing carousel) and the card manages itself.
   */
  active?: boolean;
  onVisibleRatio?: (id: string, ratio: number) => void;
  /** Tapping the card opens the full-screen viewer. */
  onOpen?: () => void;
  /** Forces the card to stay paused (the full-screen viewer is open over it). */
  paused?: boolean;
  /** High priority preload for above-the-fold posters (LCP optimization). */
  priority?: boolean;
}

const ProductVideoCard = memo(function ProductVideoCard({
  item,
  active,
  onVisibleRatio,
  onOpen,
  paused,
  priority,
}: ProductVideoCardProps) {
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  const controlled = active !== undefined;
  const pausedRef = useRef(false);

  // Self-managed: plays while the card is mostly on screen and pauses when it
  // scrolls away, so at most the one or two visible carousel cards decode.
  // Controlled: just reports visibility; `active` (below) does the playing.
  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    if (!controlled && !autoplayAllowed()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (controlled) {
          onVisibleRatio?.(item.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        } else if (entry.isIntersecting && !pausedRef.current) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: controlled ? [0, 0.6] : 0.6 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [controlled, item.id, onVisibleRatio]);

  useEffect(() => {
    if (!controlled) return;
    const video = videoRef.current;
    if (!video) return;
    if (active && !paused && autoplayAllowed()) void video.play().catch(() => {});
    else video.pause();
  }, [active, controlled, paused]);

  // While the full-screen viewer is open over this card it must stay silent.
  useEffect(() => {
    pausedRef.current = !!paused;
    if (paused) videoRef.current?.pause();
  }, [paused]);

  const price =
    item.colors?.find((c) => c.name === item.defaultVariantName)?.price ?? item.price;
  const original =
    item.discount > 0 ? floorToNearest50(price / (1 - item.discount / 100)) : null;

  return (
    <div
      ref={cardRef}
      className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black"
    >
      {!playing && (
        // unoptimized: the poster URL is already a sized Cloudinary transform,
        // and the custom loader only resizes /image/upload/ URLs — so the
        // srcset it generated here was the same URL repeated at 11 widths,
        // dead weight in the HTML of every page showing these cards.
        // `priority` is deprecated in Next 16 and set no fetchpriority; the
        // above-the-fold cards ask for it directly.
        <Image
          src={productVideoPoster(item.video, 540)}
          alt={item.name}
          fill
          unoptimized
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="absolute inset-0 object-cover pointer-events-none"
        />
      )}
      {/* No `poster` attribute: a poster is fetched as soon as the element is
          parsed — lazy loading doesn't apply to it — so every card on the
          page downloaded its still up front (~60KB each, 11 of them on a
          product page, 36 on /videos), competing with the LCP image on a
          phone's connection. The lazy <Image> above already shows that same
          still, and it stays up until `playing` (not `play`) fires, i.e. until
          a real frame is on screen, so nothing flashes black meanwhile. */}
      <video
        ref={videoRef}
        muted={muted}
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={onOpen}
        aria-label={`${item.name} – video`}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
      >
        {/* The compressed rendition first; the original upload as a fallback. */}
        <source src={productVideoUrl(item.video)} type="video/mp4" />
        <source src={item.video} />
      </video>

      {/* Tap target for videos that aren't playing (data saver / reduced motion). */}
      {!playing && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Play ${item.name} video`}
          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white shadow-lg shadow-[#B8245A]/40"
        >
          <Play className="h-5 w-5 fill-current" />
        </button>
      )}

      <div className="absolute right-2 top-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Soft black fade at the bottom, with the price and Order Now on top.
          pointer-events-none on the wrapper lets taps on the faded area reach
          the video; only the price row's button takes clicks. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 pb-2.5 pt-16">
        <p className="mb-2 flex items-baseline gap-1.5 text-white drop-shadow">
          <span className="text-base font-bold sm:text-lg">{formatAmount(price)}</span>
          {original && (
            <span className="text-xs font-medium text-white/70 line-through">
              {formatAmount(original)}
            </span>
          )}
        </p>
        <Link
          href={`/shop/${item.slug}`}
          aria-label={`${t("buyNow")}: ${item.name}`}
          className="pointer-events-auto flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-xs font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98] sm:text-sm"
        >
          <Zap className="h-3.5 w-3.5 fill-current" aria-hidden />
          {t("buyNow")}
        </Link>
      </div>
    </div>
  );
});

export default ProductVideoCard;

