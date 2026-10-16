"use client";
import { Product } from "@/lib/types";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import BrandedVideoPlayer from "@/components/product/branded-video-player";
import OptimizedImage from "@/components/ui/optimized-image";
import { autoplayAllowed, productVideoPoster, productVideoSources } from "@/lib/product-video";
import { afterLoadIdle } from "@/lib/after-load-idle";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { getOptimizedImageUrl } from "@/lib/utils";
import { cfImageUrl } from "@/lib/media-url";
import { ProductAdSlot, useProductAd } from "./product-ad-slot";

// The lightbox library (plus 6 plugins and their CSS) is only needed once the
// user taps the image, so it is loaded on demand instead of shipping in the
// product page's initial bundle.
const ProductLightbox = dynamic(() => import("./product-lightbox"), {
  ssr: false,
});

interface SwitchImageProps {
  product: Product;
}

function SwitchImage({ product }: SwitchImageProps) {
  const { siteName } = useWebsiteSettings();
  const [selectedImage, setSelectedImage] = useState(0);
  // The optional product video is the first gallery slide: it is what the
  // page opens on, with the photos after it.
  const video = product.video || null;
  const [showVideo, setShowVideo] = useState(!!video);
  // The video starts by itself, and with sound whenever the browser allows it.
  // Most don't allow sound before the visitor has touched the page, so the
  // fallback is to start muted and switch the sound on at the very first tap,
  // key press or click anywhere on the page (scrolling doesn't count as a
  // gesture to a browser, so that alone can't unmute it). Tapping the video
  // thumbnail restarts it from the beginning, with sound.
  const [videoSound, setVideoSound] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ad = useProductAd();

  useEffect(() => {
    const el = videoRef.current;
    if (!showVideo || !el) return;
    // The server can't know about data saver / reduced motion, so start it
    // here rather than with the autoPlay attribute.
    if (!videoSound && !autoplayAllowed()) return;

    let cancelled = false;
    const events = ["pointerdown", "touchend", "keydown"] as const;
    const unmute = () => {
      el.muted = false;
      events.forEach((e) => document.removeEventListener(e, unmute));
    };

    const start = () => {
      el.muted = false;
      void el.play().catch(() => {
        if (cancelled) return;
        // Sound-on autoplay refused: play silently, unmute on the first gesture.
        el.muted = true;
        void el.play().catch(() => {});
        events.forEach((e) => document.addEventListener(e, unmute, { once: true }));
      });
    };

    // A tap on the thumbnail plays right away. The automatic start waits for
    // load + idle: the MP4 is 1–2 MB, and streaming it while the page is still
    // painting delayed LCP on phones. The poster covers the wait.
    const cancelIdle = videoSound ? (start(), () => {}) : afterLoadIdle(start);

    return () => {
      cancelled = true;
      cancelIdle();
      events.forEach((e) => document.removeEventListener(e, unmute));
    };
  }, [showVideo, videoSound, video]);

  // Paused while scrolled out of view, resumed on the way back. Otherwise the
  // gallery video kept decoding under the description and reviews, and on a
  // low-end phone that background work slowed every tap further down the page.
  useEffect(() => {
    const el = videoRef.current;
    if (!showVideo || !el || typeof IntersectionObserver === "undefined") return;
    let visible = true;
    let pausedOffscreen = false;
    const pauseOffscreen = () => {
      if (visible || el.paused) return;
      el.pause();
      pausedOffscreen = true;
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) pauseOffscreen();
      else if (pausedOffscreen) {
        pausedOffscreen = false;
        void el.play().catch(() => {});
      }
    });
    observer.observe(el);
    // The automatic start waits for load + idle, by which time the visitor
    // may already have scrolled past it.
    el.addEventListener("play", pauseOffscreen);
    return () => {
      observer.disconnect();
      el.removeEventListener("play", pauseOffscreen);
    };
  }, [showVideo, videoSound, video]);
  // -1 = closed. Opens at the currently selected image.
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  // Mount the lightbox only after the first open, then keep it mounted so
  // close animations still play.
  const [lightboxMounted, setLightboxMounted] = useState(false);

  return (
    <div className="relative w-full rounded-[1.75rem] sm:rounded-[2.5rem] bg-secondary/20 overflow-hidden shadow-sm [--frame-h:17rem] sm:[--frame-h:25rem] lg:[--frame-h:34.375rem] h-[var(--frame-h)]">
      {video && showVideo ? (
        // A portrait video in this landscape frame leaves empty side bars.
        // Instead of flat black they get an ambient glow, as on YouTube: a
        // tiny copy of the video's first frame, scaled up and blurred, sits
        // behind the (letterboxed) video. A still image rather than a second
        // live video, so it costs almost nothing on a phone.
        //
        // This glow — not the video's poster — is the page's LCP element on a
        // phone: it fills the whole frame, while the portrait video only
        // covers a slice of it. So it gets fetchPriority="high" (React's SSR
        // preload for it inherits that); at ~120px wide it costs a few KB.
        <div className="absolute inset-0 overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productVideoPoster(video, 120)}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <BrandedVideoPlayer
            ref={videoRef}
            key={`${video}-${videoSound}`}
            label={`${product.name} – video`}
            loop={!videoSound}
            // The portrait video fills a slice of this frame (~153px wide on a
            // phone at 17rem, ~310px at the lg:h-137.5 desktop height).
            poster={productVideoPoster(video, 640)}
            // The thumbnails sit over the left of the frame; keep the bar clear
            // of them. On phones the ad fills the right strip top to bottom, so
            // the bar's buttons move into the video column.
            barClassName={
              ad?.slot === "compact" ? "pl-20 pr-[calc(50%-var(--frame-h)*9/32)]" : "pl-20 sm:pl-28 md:pl-32"
            }
            sources={productVideoSources(video)}
          />
          {ad && <ProductAdSlot ad={ad} price={product.price} />}
        </div>
      ) : (
      <>
      <button
        type="button"
        onClick={() => {
          setLightboxMounted(true);
          setLightboxIndex(selectedImage);
        }}
        className="absolute inset-0 cursor-zoom-in overflow-hidden bg-black"
        aria-label="Open image gallery"
      >
        {/* Reels-style, like the video: a tiny blurred copy of the photo
            fills the frame and the photo sits in a 9:16 column in the middle
            (cropped; the lightbox shows it whole). The side strips hold the
            thumbnails and the ad. At ~120px wide the glow costs a few KB. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getOptimizedImageUrl(product.images[selectedImage] || "/placeholder.jpg", 120)}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
        />
        <span className="absolute inset-y-0 left-1/2 aspect-[9/16] h-full -translate-x-1/2">
        <OptimizedImage
          src={product.images[selectedImage]}
          width={1200}
          alt={
            selectedImage === 0
              ? `${product.name} – ${siteName} Bangladesh`
              : `${product.name} – photo ${selectedImage + 1} of ${product.images.length}`
          }
          fill
          // `priority` is deprecated in Next 16; eager + high priority is the
          // documented replacement (React still preloads it in <head>).
          loading="eager"
          fetchPriority="high"
          quality={70}
          // The 9:16 column of the 17rem / sm:h-100 / lg:h-137.5 frame.
          sizes="(max-width: 639px) 160px, (max-width: 1023px) 225px, 310px"
          className="object-cover transition-transform duration-700"
        />
        </span>
      </button>
      {ad && <ProductAdSlot ad={ad} price={product.price} />}
      </>
      )}

      {/* Thumbnails Overlay. Corners concentric with the frame's: 1.75rem - left-4
          = 0.75rem (rounded-xl) on phones, 2.5rem - left-6 = 1rem from sm. */}
      {product.images.length + (video ? 1 : 0) > 1 && (
        <div className="absolute top-0 bottom-0 left-4 sm:left-6 flex flex-col justify-center gap-2 sm:gap-3 py-4 z-10">
          {video && (
            <button
              type="button"
              onClick={() => {
                setVideoSound(true);
                setShowVideo(true);
              }}
              aria-label={`Play ${product.name} video`}
              className={`relative aspect-[4/5] w-14 sm:w-20 md:w-24 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm bg-black transition-all duration-300 ${
                showVideo
                  ? "ring-2 ring-white scale-100 opacity-100 shadow-md"
                  : "opacity-70 hover:opacity-100 hover:scale-[1.02] border-2 border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // Thumbnail is at most 96px wide (md:w-24): 320w covers 3x DPR.
                src={productVideoPoster(video, 320)}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 text-black">
                  <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                </span>
              </span>
            </button>
          )}
          {product.images.slice(0, video ? 2 : 3).map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedImage(index);
                setShowVideo(false);
              }}
              className={`relative aspect-[4/5] w-14 sm:w-20 md:w-24 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${
                !showVideo && selectedImage === index
                  ? "ring-2 ring-white scale-100 opacity-100 shadow-md"
                  : "opacity-70 hover:opacity-100 hover:scale-[1.02] border-2 border-transparent"
              }`}
            >
              <OptimizedImage
                src={image}
                width={100}
                fill
                sizes="(max-width: 640px) 56px, 96px"
                alt={`${product.name} – photo ${index + 1} of ${product.images.length}`}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Gallery */}
      {lightboxMounted && (
        <ProductLightbox
          index={lightboxIndex}
          slides={
            product.images.length > 0
              ? product.images.map((src, idx) => ({
                  // AVIF at the stored size (≤1600px) instead of the original
                  // JPEG — about 45% smaller for these detailed fabric
                  // photos at quality 60 — and a small thumbnail for the
                  // strip rather than every full image.
                  src: cfImageUrl(src, "width=1600,quality=60,format=auto,fit=scale-down"),
                  thumbnail: cfImageUrl(src, "width=240,quality=60,format=auto,fit=scale-down"),
                  title: product.name,
                  description: `Photo ${idx + 1} of ${product.images.length}`,
                }))
              : [{ src: "/placeholder.jpg", title: product.name, description: "" }]
          }
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
        />
      )}
    </div>
  );
}

export default SwitchImage;
