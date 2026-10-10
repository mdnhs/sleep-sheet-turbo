"use client"

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  if (!src) return ""

  // Optimize Cloudinary assets directly via Cloudinary CDN URL transforms
  if (src.startsWith("https://res.cloudinary.com/")) {
    const uploadIndex = src.indexOf("/image/upload/")
    if (uploadIndex !== -1) {
      const start = src.slice(0, uploadIndex + 14)
      let rest = src.slice(uploadIndex + 14)

      // Strip any existing transformation segment before applying responsive params
      if (/^(?:[a-z]_[^/]+,)*[a-z]_[^/]+\//.test(rest)) {
        rest = rest.replace(/^(?:[a-z]_[^/]+,)*[a-z]_[^/]+\//, "")
      }

      const q = quality ? `q_${quality}` : "q_auto:good"
      const transform = `f_auto,${q},c_limit,w_${width}/`
      return `${start}${transform}${rest}`
    }
  }

  // Optimize Unsplash images via their native URL query parameters
  if (src.includes("images.unsplash.com")) {
    try {
      const url = new URL(src)
      url.searchParams.set("w", String(width))
      url.searchParams.set("q", String(quality || 75))
      url.searchParams.set("auto", "format")
      return url.toString()
    } catch {
      return src
    }
  }

  // Local images (e.g. /logo.png, /placeholder.jpg) served directly from /public
  if (src === "/logo.png") return "/logo.webp"
  if (src === "/hero-banner-1.png") return "/hero-banner-1.webp"
  if (src === "/hero-banner-2.png") return "/hero-banner-2.webp"
  if (src === "/hero-slider-1.png") return "/hero-slider-1.webp"
  if (src === "/sleep-sheet-logo.jpg") return "/sleep-sheet-logo.webp"
  return src
}
