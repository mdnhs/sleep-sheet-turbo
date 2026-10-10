"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Heart, Share2, Volume2, VolumeX, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { floorToNearest50 } from "@/lib/utils";
import {
  productVideoPoster,
  productVideoUrl,
  saveDataEnabled,
  videoShareUrl,
} from "@/lib/product-video";
import { sendVideoStats } from "@/lib/video-stats";
import { useVideoLikes } from "@/features/product/api/use-video-likes";
import BrandedVideoPlayer from "@/components/product/branded-video-player";
import type { ProductVideoItem } from "@/lib/types";

const HINT_KEY = "ss_reels_hint_seen";

const compactCount = new Intl.NumberFormat("en", { notation: "compact" });

// A watch shorter than this isn't counted as a view (a swipe straight past).
const MIN_VIEW_SECONDS = 1;

function hintSeenThisSession(): boolean {
  try {
    return sessionStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markHintSeen() {
  try {
    sessionStorage.setItem(HINT_KEY, "1");
  } catch {
    /* storage unavailable — the hint just shows again next time */
  }
}

interface ReelsViewerProps {
  items: ProductVideoItem[];
  startIndex: number;
  onClose: () => void;
  /** Called with the real index (not a padding copy) each time the visible video changes. */
  onActiveChange?: (index: number) => void;
  /**
   * The viewer pushes a history entry so the back button closes it. A host that
   * keeps the open video in the URL (the /videos page) does that itself and
   * turns this off.
   */
  manageHistory?: boolean;
}

/**
 * Full-screen, Reels-style viewer. Each video is one screen-high slide in a
 * vertical scroll-snap list, so swiping (or scrolling, arrow keys, the
 * up/down buttons) moves to the next or previous one natively. Only the
 * slide on screen plays; the ones either side keep their <video> mounted so
 * the next swipe starts instantly, and every other slide is just a poster.
 *
 * It loops forever: with more than one video the list is padded with a copy of
 * the last video before the first and a copy of the first after the last, and
 * once a swipe settles on a copy the scroll position is silently moved to the
 * real slide, so there is no first or last.
 *
 * Smoothness: the next video (and the slide a padding copy mirrors) is
 * buffered ahead unless the visitor has Data Saver on, posters far from the screen load
 * lazily, and playback pauses while the tab is hidden. A host that only has
 * some of the videos (the landing row) gets the rest fetched in the
 * background once the viewer opens.
 *
 * It is only ever mounted after a tap (never during SSR), which is why it can
 * portal into document.body directly. That tap also means playback starts with
 * sound, and is the user gesture later slides rely on to keep playing with it.
 */
export default function ReelsViewer({
  items,
  startIndex: requestedStart,
  onClose,
  onActiveChange,
  manageHistory = true,
}: ReelsViewerProps) {
  const { siteName } = useWebsiteSettings();
  const { formatAmount } = useCurrency();
  const { t } = useLanguage();
  // Frozen at mount: the host may move its own index along as the visitor
  // swipes, which must never scroll the list underneath them.
  const [startIndex] = useState(requestedStart);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const closeRef = useRef<HTMLButtonElement>(null);
  // Videos the host didn't pass in (it may only have the first dozen), fetched
  // after opening and appended — only while a real slide is on screen, so a
  // padding copy never changes under the visitor.
  const [extra, setExtra] = useState<ProductVideoItem[]>([]);
  const pendingExtra = useRef<ProductVideoItem[] | null>(null);
  const allItems = useMemo(() => (extra.length ? [...items, ...extra] : items), [items, extra]);
  const n = allItems.length;
  const loop = n > 1;
  // Slide positions: with looping, 0 is a copy of the last video, 1..n are the
  // real ones, and n + 1 is a copy of the first. `active` is a position.
  const slides = useMemo(
    () => (loop ? [allItems[n - 1], ...allItems, allItems[0]] : allItems),
    [allItems, loop, n],
  );
  const offset = loop ? 1 : 0;
  const [active, setActive] = useState(startIndex + offset);
  const [muted, setMuted] = useState(false);
  const activeRef = useRef(startIndex + offset);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touching = useRef(false);
  // Animated "swipe up" cue at the left edge: shown once per browser session,
  // until the first swipe (or a few seconds).
  const [hint, setHint] = useState(() => n > 1 && !hintSeenThisSession());
  const realIndex = loop ? (active - 1 + n) % n : active;
  const { counts, liked, toggle } = useVideoLikes(items, t("likeFailed"));
  // Hearts popping up where the visitor double-tapped.
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  // Data Saver: only the video on screen is buffered.
  const [saveData] = useState(saveDataEnabled);

  // Watch-time tracking for the video on screen (keyed by product, so the
  // silent jump between a padding copy and its real slide isn't a new view).
  const watch = useRef<{ id: string; since: number | null; seconds: number } | null>(null);
  const flushWatch = useCallback(() => {
    const current = watch.current;
    if (!current) return;
    const seconds = current.seconds + (current.since === null ? 0 : (performance.now() - current.since) / 1000);
    watch.current = null;
    if (seconds >= MIN_VIEW_SECONDS) sendVideoStats(current.id, { views: 1, watchSeconds: seconds });
  }, []);
  const activeItemId = slides[active]?.id;
  useEffect(() => {
    if (!activeItemId) return;
    if (watch.current?.id === activeItemId) return;
    flushWatch();
    watch.current = {
      id: activeItemId,
      since: document.visibilityState === "visible" ? performance.now() : null,
      seconds: 0,
    };
  }, [activeItemId, flushWatch]);
  useEffect(() => flushWatch, [flushWatch]);

  const share = async (item: ProductVideoItem) => {
    const url = videoShareUrl(window.location.origin, item.slug);
    try {
      if (navigator.share) {
        // URL only: Android's "Copy" joins text + url, which broke pasting into the address bar.
        await navigator.share({ url });
        sendVideoStats(item.id, { shares: 1 });
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return; // the visitor closed the sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      sendVideoStats(item.id, { shares: 1 });
      toast.success(t("linkCopied"));
    } catch {
      toast(url);
    }
  };

  // Android/iOS back button closes the viewer instead of leaving the page:
  // opening pushes one history entry, and popping it (or closing by hand,
  // which pops it) is what actually closes.
  useEffect(() => {
    if (!manageHistory) return;
    history.pushState({ reels: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose, manageHistory]);

  const close = useCallback(() => {
    if (manageHistory && history.state?.reels) history.back();
    else onClose();
  }, [onClose, manageHistory]);

  // Freeze the page behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Start on the tapped video, before the first paint.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = (startIndex + offset) * scroller.clientHeight;
    closeRef.current?.focus();
  }, [startIndex, offset]);

  useEffect(() => {
    markHintSeen();
    const hide = setTimeout(() => setHint(false), 6000);
    return () => {
      clearTimeout(hide);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  // Fetch the videos the host didn't have (same cached list the /videos page uses).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products/videos?limit=100")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: ProductVideoItem[] } | null) => {
        if (cancelled || !body) return;
        const known = new Set(items.map((item) => item.id));
        const missing = body.data.filter((item) => !known.has(item.id));
        if (missing.length) pendingExtra.current = missing;
        applyPendingExtra();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPendingExtra = useCallback(() => {
    if (!pendingExtra.current) return;
    const position = activeRef.current;
    const onPaddingCopy = loopRef.current && (position === 0 || position === nRef.current + 1);
    if (onPaddingCopy || touching.current) return;
    setExtra(pendingExtra.current);
    pendingExtra.current = null;
  }, []);
  const loopRef = useRef(loop);
  const nRef = useRef(n);
  useEffect(() => {
    loopRef.current = loop;
    nRef.current = n;
  }, [loop, n]);

  // Pause while the tab or app is in the background; resume on return.
  useEffect(() => {
    // Only resume what the background paused, not a video the visitor paused.
    let resume = false;
    const onVisibility = () => {
      const video = videoRefs.current.get(activeRef.current);
      if (document.visibilityState === "hidden") {
        resume = Boolean(video && !video.paused);
        video?.pause();
        if (watch.current?.since != null) {
          watch.current.seconds += (performance.now() - watch.current.since) / 1000;
          watch.current.since = null;
        }
      } else {
        if (video && resume) void video.play().catch(() => {});
        if (watch.current && watch.current.since === null) watch.current.since = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    // A closed tab or a navigation away still reports the last video's watch.
    window.addEventListener("pagehide", flushWatch);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushWatch);
    };
  }, [flushWatch]);

  // Looping: once scrolling has stopped on a padding copy, move to the real
  // slide it copies. Assigning scrollTop is instant (no smooth scroll), and the
  // two slides look identical, so the jump is invisible. It waits for the
  // finger to lift — moving the scroll position under a held finger would
  // cancel the drag.
  const settle = useCallback(function run() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (touching.current) {
      settleTimer.current = setTimeout(run, 150);
      return;
    }
    const height = scroller.clientHeight;
    const position = Math.round(scroller.scrollTop / height);
    const target = position === 0 ? n : position === n + 1 ? 1 : -1;
    if (target !== -1) {
      // Carry the playback position over, so the video keeps going instead of
      // restarting from the beginning after the jump.
      const from = videoRefs.current.get(position);
      const to = videoRefs.current.get(target);
      if (from && to && from.currentTime > 0) {
        try {
          to.currentTime = from.currentTime;
        } catch {
          /* not seekable yet — it just starts from the top */
        }
      }
      scroller.scrollTop = target * height;
    } else {
      applyPendingExtra();
    }
  }, [n, applyPendingExtra]);

  const handleScroll = () => {
    if (!loop) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 120);
  };

  // The slide that is mostly on screen is the active one.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Over half on screen: the swipe has committed to this slide.
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          const position = Number((entry.target as HTMLElement).dataset.index);
          const previous = activeRef.current;
          if (position === previous) continue;
          activeRef.current = position;
          setActive(position);
          onActiveChange?.(loop ? (position - 1 + n) % n : position);
          // A step of exactly one slide is a swipe (the silent jump off a
          // padding copy is not).
          if (Math.abs(position - previous) === 1) setHint(false);
        }
      },
      { root: scroller, threshold: 0.5 },
    );
    scroller.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  // Play the active slide, pause (and rewind) the rest.
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (index === active) {
        video.muted = muted;
        if (document.visibilityState === "hidden") return;
        const attempt = (retried: boolean) => {
          if (activeRef.current !== index) return;
          void video.play().catch((error: Error) => {
            if (activeRef.current !== index) return;
            if (error.name === "NotAllowedError") {
              // A browser that refuses sound-on playback gets it muted instead of nothing.
              video.muted = true;
              setMuted(true);
              void video.play().catch(() => {});
            } else if (!retried) {
              // Not ready yet (or the source was swapped under it): try again
              // as soon as it can play.
              video.addEventListener("canplay", () => attempt(true), { once: true });
            }
          });
        };
        attempt(false);
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [active, muted]);

  const likeByDoubleTap = (item: ProductVideoItem, point: { x: number; y: number }) => {
    const id = Date.now() + Math.random();
    setBursts((prev) => [...prev, { id, ...point }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 900);
    // Like only — a double tap never takes a like back.
    if (!liked.has(item.id)) void toggle(item.id);
  };

  const go = useCallback((delta: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = Math.min(Math.max(active + delta, 0), slides.length - 1);
    scroller.scrollTo({ top: next * scroller.clientHeight, behavior: "smooth" });
  }, [active, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("watchAndShop")}
      className="fixed inset-0 z-[200] bg-black"
    >
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          touching.current = true;
        }}
        onTouchEnd={() => {
          touching.current = false;
          handleScroll();
        }}
        onTouchCancel={() => {
          touching.current = false;
          handleScroll();
        }}
        className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((item, index) => {
          const price =
            item.colors?.find((c) => c.name === item.defaultVariantName)?.price ?? item.price;
          const original =
            item.discount > 0 ? floorToNearest50(price / (1 - item.discount / 100)) : null;
          // Neighbours of the active slide stay mounted for instant swipes. So
          // does the real slide a padding copy mirrors, so the silent jump
          // lands on a slide that is already loaded.
          const mirror = active === 0 ? n : active === n + 1 ? 1 : -1;
          const live = Math.abs(index - active) <= 1 || index === mirror;
          // Buffer ahead: the video on screen, the next one, and the mirror
          // slide a padding copy is about to jump to. Data Saver: on-screen only.
          const preload =
            index === active || (!saveData && (index === active + 1 || index === mirror))
              ? "auto"
              : "metadata";

          return (
            <section
              key={`${item.id}-${index}`}
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
                  ref={(el) => {
                    if (el) videoRefs.current.set(index, el);
                    else videoRefs.current.delete(index);
                  }}
                  variant="minimal"
                  loop
                  preload={preload}
                  poster={productVideoPoster(item.video)}
                  label={`${item.name} – video`}
                  className="max-w-full"
                  onDoubleTap={(point) => likeByDoubleTap(item, point)}
                  sources={[
                    { src: productVideoUrl(item.video), type: "video/mp4" },
                    { src: item.video },
                  ]}
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
                      {compactCount.format(counts[item.id] ?? item.likes ?? 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggle(item.id)}
                      aria-pressed={liked.has(item.id)}
                      aria-label={liked.has(item.id) ? t("unlikeVideo") : t("likeVideo")}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 transition-transform active:scale-90"
                    >
                      <Heart
                        className={
                          liked.has(item.id)
                            ? "h-6 w-6 fill-[#FF3B7F] text-[#FF3B7F]"
                            : "h-6 w-6"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void share(item)}
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
        })}
      </div>

      {bursts.map((burst) => (
        <Heart
          key={burst.id}
          aria-hidden="true"
          className="animate-reels-heart-burst pointer-events-none absolute z-30 h-24 w-24 fill-[#FF3B7F] text-[#FF3B7F] drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
          style={{ left: burst.x, top: burst.y }}
        />
      ))}

      {hint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2 motion-reduce:hidden"
        >
          <div className="relative flex h-36 w-11 flex-col items-center justify-between rounded-full bg-black/35 py-2 backdrop-blur-sm">
            {[2, 1, 0].map((step) => (
              <ChevronUp
                key={step}
                className="animate-reels-chevron h-6 w-6 text-white"
                style={{ animationDelay: `${step * 0.25}s` }}
              />
            ))}
            <span className="animate-reels-dot absolute bottom-2 left-1/2 h-7 w-7 rounded-full bg-white/90 shadow-[0_0_0_5px_rgba(255,255,255,0.28)]" />
          </div>
        </div>
      )}

      <button
        ref={closeRef}
        type="button"
        onClick={close}
        aria-label="Close videos"
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <span className="absolute left-1/2 top-[max(1.1rem,env(safe-area-inset-top))] -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
        {realIndex + 1} / {n}
      </span>

      {/* Mouse users: previous / next, alongside the swipe, wheel and arrow keys. */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!loop && active === 0}
          aria-label="Previous video"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!loop && active === slides.length - 1}
          aria-label="Next video"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
