import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-config", () => ({ getR2Config: vi.fn() }));

const { r2KeyFromUrl, r2PublicUrl } = await import("./r2");

describe("R2 object keys", () => {
  const base = "https://media.example.com";

  it("round-trips a key through its public URL", () => {
    expect(r2KeyFromUrl(r2PublicUrl(`${base}/`, "products/a.jpg"), base)).toBe("products/a.jpg");
  });

  it("refuses URLs outside the bucket or with path tricks", () => {
    expect(r2KeyFromUrl("https://media.example.com.evil.io/products/a.jpg", base)).toBeNull();
    expect(r2KeyFromUrl("https://res.cloudinary.com/demo/image/upload/a.jpg", base)).toBeNull();
    expect(r2KeyFromUrl(`${base}/products/../secret`, base)).toBeNull();
    expect(r2KeyFromUrl(`${base}/`, base)).toBeNull();
    expect(r2KeyFromUrl(`${base}/products/a.jpg`, "")).toBeNull();
  });

  it("drops a query string", () => {
    expect(r2KeyFromUrl(`${base}/products/a.jpg?v=2`, base)).toBe("products/a.jpg");
  });
});
