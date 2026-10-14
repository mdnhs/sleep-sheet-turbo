"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import Link from "next/link";
import { Play, Volume2, VolumeX, Zap } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { floorToNearest50 } from "@/lib/utils";
import { autoplayAllowed, productVideoFramePoster, productVideoPoster, productVideoSources } from "@/lib/product-video";
import type { ProductVideoItem } from "@/lib/types";
import { afterLoadIdle } from "@/lib/after-load-idle";
import { useAfterLoadIdle } from "@/hooks/use-after-load-idle";

// Poster widths for the srcset: half-width phone cards (~160px at 2–3x DPR)
// up to the 20vw desktop column.
const POSTER_WIDTHS = [270, 400, 540];

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
  // The stored still failed (not generated yet): take it live from the video.
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = posterFailed ? productVideoFramePoster : productVideoPoster;
  // Non-priority posters wait for load + idle. `loading="lazy"` didn't hold
  // them back: Chrome's lazy-load margin is 1250px+ on mobile, so a whole
  // carousel of ~40 KB stills downloaded alongside the page's LCP image.
  const posterReady = useAfterLoadIdle() || !!priority;

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

    // Start watching only once the page has loaded and gone idle. Observing at
    // hydration meant the visible carousel cards began streaming their MP4s
    // (1–2 MB each) while the hero image was still painting, and on a phone
    // connection that pushed the home page's LCP past 10s in Lighthouse.
    let observer: IntersectionObserver | undefined;
    const start = () => {
      observer = new IntersectionObserver(
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
    };
    const cancel = afterLoadIdle(start);
    return () => {
      cancel();
      observer?.disconnect();
    };
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
      {!playing && posterReady && (
        // A plain <img> with a hand-built srcset: the poster URL carries its
        // own width (an R2 still through /cdn-cgi/image, or a Cloudinary
        // video-frame transform), which next/image's loader doesn't build —
        // it either repeated one URL at 11 widths or, unoptimized, sent the
        // 540w still to a 157px-wide phone card.
        // `priority` is deprecated in Next 16 and set no fetchpriority; the
        // above-the-fold cards ask for it directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster(item.video, 540)}
          srcSet={POSTER_WIDTHS.map((w) => `${poster(item.video, w)} ${w}w`).join(", ")}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}
      {/* No `poster` attribute: a poster is fetched as soon as the element is
          parsed — lazy loading doesn't apply to it — so every card on the
          page downloaded its still up front (~60KB each, 11 of them on a
          product page, 36 on /videos), competing with the LCP image on a
          phone's connection. The lazy <img> above already shows that same
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
        {/* The small grid rendition first, then fallbacks (productVideoSources). */}
        {productVideoSources(item.video, "sd").map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
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

