import { FileQuestion, Film } from "lucide-react";
import type { MediaItem } from "@/features/media/types";
import { productVideoPoster } from "@/lib/product-video";
import { getOptimizedImageUrl } from "@/lib/utils";

/** Square-filling preview of a library file: the image, a video still, or a placeholder. */
export function MediaThumb({ item, size }: { item: Pick<MediaItem, "url" | "name" | "kind">; size: number }) {
  if (item.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- already resized by getOptimizedImageUrl
    return <img src={getOptimizedImageUrl(item.url, size)} alt={item.name} loading="lazy" className="h-full w-full object-cover" />;
  }
  if (item.kind === "video") {
    return (
      <div className="relative h-full w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated still */}
        <img src={productVideoPoster(item.url, size)} alt={item.name} loading="lazy" className="h-full w-full object-cover opacity-90" />
        <Film className="absolute bottom-2 right-2 h-4 w-4 text-white drop-shadow" />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <FileQuestion className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}
