import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCloudinaryVideoUrl,
  isProductVideoKey,
  isR2VideoUrl,
  videoShareUrl,
  productVideoOgImage,
  productVideoPoster,
  productVideoPublicId,
  productVideoUrl,
  productVideoFramePoster,
  productVideoSources,
  videoDerivativeKey,
  videoDerivativeUrl,
} from "./product-video";

const url = "https://res.cloudinary.com/demo/video/upload/v1712345678/products-video/abc123xyz.mov";

describe("isCloudinaryVideoUrl", () => {
  it("accepts a Cloudinary video URL, optionally for a given account", () => {
    expect(isCloudinaryVideoUrl(url)).toBe(true);
    expect(isCloudinaryVideoUrl(url, "demo")).toBe(true);
  });

  it("rejects another account's video when the cloud name is known", () => {
    expect(isCloudinaryVideoUrl(url, "someone-else")).toBe(false);
  });

  it("rejects images, other hosts, plain http and junk", () => {
    expect(isCloudinaryVideoUrl("https://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toBe(false);
    expect(isCloudinaryVideoUrl("https://evil.example/demo/video/upload/v1/a.mp4")).toBe(false);
    expect(isCloudinaryVideoUrl("http://res.cloudinary.com/demo/video/upload/v1/a.mp4")).toBe(false);
    expect(isCloudinaryVideoUrl("javascript:alert(1)")).toBe(false);
    expect(isCloudinaryVideoUrl("not a url")).toBe(false);
  });

  it("rejects query strings and fragments", () => {
    expect(isCloudinaryVideoUrl(`${url}?x=1`)).toBe(false);
    expect(isCloudinaryVideoUrl(`${url}#frag`)).toBe(false);
  });
});

describe("delivery urls", () => {
  it("builds the compressed mp4 rendition and swaps the extension", () => {
    expect(productVideoUrl(url)).toBe(
      "https://res.cloudinary.com/demo/video/upload/c_limit,w_960,q_auto,f_mp4/v1712345678/products-video/abc123xyz.mp4",
    );
  });

  it("builds a poster from the first frame", () => {
    expect(productVideoPoster(url)).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,c_limit,w_960,q_auto,f_auto/v1712345678/products-video/abc123xyz.jpg",
    );
  });
});

describe("videoShareUrl", () => {
  it("is the videos page opened on that video", () => {
    expect(videoShareUrl("https://sleepsheetbd.com", "red-polka-dot-ab12")).toBe(
      "https://sleepsheetbd.com/videos?v=red-polka-dot-ab12",
    );
  });

  it("escapes anything that isn't URL-safe", () => {
    expect(videoShareUrl("https://x.test", "a b&c")).toBe("https://x.test/videos?v=a%20b%26c");
  });
});

describe("productVideoOgImage", () => {
  it("is a 1200x630 first-frame crop for share cards", () => {
    expect(productVideoOgImage(url)).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,c_fill,w_1200,h_630,q_auto,f_jpg/v1712345678/products-video/abc123xyz.jpg",
    );
  });
});

describe("productVideoPublicId", () => {
  it("returns folder/name without the version or extension", () => {
    expect(productVideoPublicId(url)).toBe("products-video/abc123xyz");
  });

  it("works without a version segment", () => {
    expect(productVideoPublicId("https://res.cloudinary.com/demo/video/upload/products-video/abc.mp4")).toBe(
      "products-video/abc",
    );
  });

  it("returns null for a non-video url", () => {
    expect(productVideoPublicId("https://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toBeNull();
  });
});

describe("R2 videos", () => {
  const r2 = "https://media.example.com/products-video/AbC_123-xyz.mp4";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only a video file in this bucket's video folder", () => {
    expect(isR2VideoUrl(r2, "https://media.example.com")).toBe(true);
    expect(isR2VideoUrl(r2, "https://media.example.com/")).toBe(true);
    expect(isR2VideoUrl(r2, "https://other.example.com")).toBe(false);
    expect(isR2VideoUrl("https://media.example.com/products/a.mp4", "https://media.example.com")).toBe(false);
    expect(isR2VideoUrl("https://media.example.com/products-video/a.exe", "https://media.example.com")).toBe(false);
    expect(isR2VideoUrl("https://media.example.com/products-video/../a.mp4", "https://media.example.com")).toBe(false);
    expect(isR2VideoUrl(`${r2}?x=1`, "https://media.example.com")).toBe(false);
    expect(isR2VideoUrl("https://media.example.com.evil.io/products-video/a.mp4", "https://media.example.com")).toBe(false);
    expect(isR2VideoUrl(r2, "")).toBe(false);
  });

  it("offers only library keys the product form accepts", () => {
    expect(isProductVideoKey("products-video/AbC_123-xyz.mp4")).toBe(true);
    expect(isProductVideoKey("products-video/clip.mov")).toBe(true);
    expect(isProductVideoKey("products-video/clip.webm")).toBe(false);
    expect(isProductVideoKey("library/clip.mp4")).toBe(false);
    expect(isProductVideoKey("products-video/sub/clip.mp4")).toBe(false);
  });

  it("delivers the stored derivatives, posters resized through /cdn-cgi/image", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com/");
    const derived = "https://media.example.com/_derived/v1/products-video/AbC_123-xyz";
    expect(productVideoUrl(r2)).toBe(`${derived}/720.mp4`);
    expect(productVideoUrl(r2, "sd")).toBe(`${derived}/480.mp4`);
    expect(productVideoPoster(r2, 320)).toBe(
      `https://shop.example.com/cdn-cgi/image/width=320,quality=60,format=auto,fit=scale-down/${derived}/poster.jpg`,
    );
    expect(productVideoOgImage(r2)).toBe(
      `https://shop.example.com/cdn-cgi/image/width=1200,height=630,fit=cover,format=jpeg/${derived}/poster.jpg`,
    );
    expect(productVideoFramePoster(r2, 320)).toBe(
      `https://shop.example.com/cdn-cgi/media/mode=frame,time=0s,width=320,fit=scale-down,format=jpg/${r2}`,
    );
    expect(productVideoPublicId(r2)).toBeNull();
  });

  it("lists the stored rendition, then the live transform, then the original", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "https://shop.example.com");
    expect(productVideoSources(r2, "sd")).toEqual([
      { src: "https://media.example.com/_derived/v1/products-video/AbC_123-xyz/480.mp4", type: "video/mp4" },
      { src: `https://shop.example.com/cdn-cgi/media/mode=video,width=960,fit=scale-down/${r2}`, type: "video/mp4" },
      { src: r2 },
    ]);
  });

  it("still uses the stored files without a transform origin (local dev)", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN", "");
    const derived = "https://media.example.com/_derived/v1/products-video/AbC_123-xyz";
    expect(productVideoPoster(r2)).toBe(`${derived}/poster.jpg`);
    expect(productVideoSources(r2)).toEqual([{ src: `${derived}/720.mp4`, type: "video/mp4" }, { src: r2 }]);
  });

  it("derives keys only for product video keys", () => {
    expect(videoDerivativeKey("products-video/a.mov", "poster")).toBe("_derived/v1/products-video/a/poster.jpg");
    expect(videoDerivativeKey("products/a.jpg", "poster")).toBeNull();
    expect(videoDerivativeUrl("https://media.example.com/products/a.jpg", "hd")).toBeNull();
  });
});
