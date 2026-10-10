"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export const PLACEHOLDER_SRC = "/placeholder.jpg";

type FallbackImageProps = Omit<ImageProps, "src"> & {
  src?: ImageProps["src"] | null;
};

// next/image with the grayscale placeholder as a safety net: an empty/missing
// src (which next/image would otherwise throw on) or an image that fails to
// load renders /placeholder.jpg instead. Same props as next/image, so any
// custom `loader`, `fill`, `sizes` and classes keep working.
export default function FallbackImage({ src, onError, ...props }: FallbackImageProps) {
  const [failedSrc, setFailedSrc] = useState<FallbackImageProps["src"]>(null);
  const showPlaceholder = !src || failedSrc === src;

  return (
    <Image
      {...props}
      src={showPlaceholder ? PLACEHOLDER_SRC : src}
      onError={(e) => {
        if (!showPlaceholder) setFailedSrc(src);
        onError?.(e);
      }}
    />
  );
}
