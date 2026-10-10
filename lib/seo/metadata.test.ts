import { describe, expect, it } from "vitest";
import { generateMetadata, generateProductMetadata, stripStoreSuffix } from "@/lib/seo/metadata";
import { webpageSchema } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/seo/config";

const store = { name: "Nimbus Linen", locale: "bn_BD", defaultImage: "/og-image.png" };

describe("page metadata", () => {
  it("puts the store name in the title exactly once", () => {
    const meta = generateMetadata({ title: "About Us", description: "d", canonical: "/about" }, store);
    expect(meta.title).toEqual({ absolute: "About Us | Nimbus Linen" });
    expect(meta.openGraph?.title).toBe("About Us | Nimbus Linen");
    expect(meta.openGraph?.siteName).toBe("Nimbus Linen");
  });

  it("leaves verification to the root layout", () => {
    expect(generateMetadata({ title: "T", description: "d" }, store)).not.toHaveProperty("verification");
  });

  it("names the store in a product's fallback description", () => {
    const meta = generateProductMetadata({ name: "Blue Sheet", description: "", slug: "blue" }, store);
    expect(meta.description).toBe("Shop Blue Sheet at Nimbus Linen");
  });

  it("strips a store-name suffix an admin typed into an SEO title", () => {
    expect(stripStoreSuffix("Comforters | Nimbus Linen", "Nimbus Linen")).toBe("Comforters");
    expect(stripStoreSuffix("Comforters | nimbus linen bd", "Nimbus Linen")).toBe("Comforters");
    expect(stripStoreSuffix("Comforters", "Nimbus Linen")).toBe("Comforters");
  });
});

describe("webpageSchema", () => {
  it("credits the store as publisher", () => {
    const page = JSON.parse(webpageSchema("About", "d", `${siteUrl}/about`, { name: "Nimbus Linen", logoUrl: "/l.png" }));
    expect(page.publisher).toEqual({ "@type": "Organization", name: "Nimbus Linen", logo: `${siteUrl}/l.png` });
  });
});
