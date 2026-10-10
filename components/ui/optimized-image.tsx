"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { getOptimizedImageUrl } from "@/lib/utils";

type OptimizedImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
  /** Target width hint for the Cloudinary transform. */
  width?: number;
  fallbackSrc?: string;
};

// Cloudinary's "Strict Transformations" setting rejects any on-the-fly
// transform (f_auto/q_auto/w_*) it hasn't already generated, returning a 404
// for otherwise-valid images — most often ones uploaded after the setting
// was turned on. When that happens, retry once with the untouched original
// URL and unoptimized (bypassing the custom loader) so the image still
// renders, instead of a permanently broken <img>.
export default function OptimizedImage({
  src,
  width,
  fallbackSrc = "/placeholder.jpg",
  ...props
}: OptimizedImageProps) {
  // 0 = optimized URL, 1 = untouched original, 2 = placeholder. Each load
  // error moves one step down, so a file that's gone from Cloudinary entirely
  // (original 404s too) ends on the placeholder instead of a broken image.
  // Tracked per-src so a new src starts over at stage 0 without an effect.
  const [state, setState] = useState<{ src: typeof src; stage: 0 | 1 | 2 }>({ src, stage: 0 });
  const stage = state.src === src ? state.stage : 0;

  if (!src || stage === 2) {
    return <Image {...props} src={fallbackSrc} />;
  }

  if (stage === 1) {
    return <Image {...props} src={src} unoptimized onError={() => setState({ src, stage: 2 })} />;
  }

  return (
    <Image
      {...props}
      src={getOptimizedImageUrl(src, width) || fallbackSrc}
      onError={() => setState({ src, stage: 1 })}
    />
  );
}
