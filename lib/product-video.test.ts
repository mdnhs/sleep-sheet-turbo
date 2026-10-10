import { describe, expect, it } from "vitest";
import {
  isCloudinaryVideoUrl,
  videoShareUrl,
  productVideoOgImage,
  productVideoPoster,
  productVideoPublicId,
  productVideoUrl,
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
