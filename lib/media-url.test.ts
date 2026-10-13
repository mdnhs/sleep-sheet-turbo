import { afterEach, describe, expect, it, vi } from "vitest";
import imageLoader from "./image-loader";
import { cfImageUrl, unwrapCfImageUrl } from "./media-url";
import { getImageIdentity, getOptimizedImageUrl } from "./utils";

const src = "https://media.example.com/products/abc.jpg";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Cloudflare image URLs", () => {
  it("wraps an R2 image once, re-wrapping instead of nesting", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    const once = cfImageUrl(src, "width=640");
    expect(once).toBe(`https://shop.example.com/cdn-cgi/image/width=640/${src}`);
    expect(unwrapCfImageUrl(once)).toBe(src);
    expect(cfImageUrl(once, "width=320")).toBe(`https://shop.example.com/cdn-cgi/image/width=320/${src}`);
  });

  it("leaves video stills and non-https sources alone", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    const still = `https://shop.example.com/cdn-cgi/media/mode=frame,width=320/${src}`;
    expect(cfImageUrl(still, "width=640")).toBe(still);
    expect(cfImageUrl("/logo.webp", "width=640")).toBe("/logo.webp");
  });

  it("serves the original without a transform origin", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "");
    expect(cfImageUrl(src, "width=640")).toBe(src);
  });

  it("is what next/image's loader and getOptimizedImageUrl produce for R2", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    expect(imageLoader({ src, width: 640 })).toBe(
      `https://shop.example.com/cdn-cgi/image/width=640,quality=85,format=auto,fit=scale-down/${src}`,
    );
    // OptimizedImage feeds getOptimizedImageUrl's output to the loader.
    expect(imageLoader({ src: getOptimizedImageUrl(src, 1000), width: 384, quality: 70 })).toBe(
      `https://shop.example.com/cdn-cgi/image/width=384,quality=70,format=auto,fit=scale-down/${src}`,
    );
  });

  it("keeps Cloudinary URLs on Cloudinary transforms", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    const cld = "https://res.cloudinary.com/demo/image/upload/v1/products/a.jpg";
    expect(imageLoader({ src: cld, width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_640/v1/products/a.jpg",
    );
    expect(getOptimizedImageUrl(cld, 640)).toContain("res.cloudinary.com");
  });
});

describe("getImageIdentity", () => {
  it("is the object path for R2, wrapped or not", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    expect(getImageIdentity(src)).toBe("products/abc");
    expect(getImageIdentity(cfImageUrl(src, "width=640"))).toBe("products/abc");
  });

  it("is the public id for Cloudinary", () => {
    expect(getImageIdentity("https://res.cloudinary.com/demo/image/upload/f_auto,w_300/v12/products/a.jpg")).toBe(
      "products/a",
    );
  });
});
