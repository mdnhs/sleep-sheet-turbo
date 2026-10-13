import { db } from "@/db";
import { categories, posts, products, siteSettings, testimonials } from "@/db/schema";

import type { MediaUse } from "@/features/media/types";

/**
 * Where each stored media URL is referenced: product galleries and videos,
 * category and testimonial images, blog covers and post bodies, product
 * descriptions / category SEO text, and plain-text settings (logo, hero,
 * banners, product ad). Exact columns match by equality; free text by
 * substring. The catalog is small, so this reads it whole per request.
 */
export async function mediaUsage(urls: string[]): Promise<Map<string, MediaUse[]>> {
  const wanted = new Set(urls);
  const uses = new Map<string, MediaUse[]>();
  const add = (url: string, use: MediaUse) => {
    if (!wanted.has(url)) return;
    const list = uses.get(url) ?? [];
    if (!list.some((u) => u.href === use.href && u.label === use.label)) list.push(use);
    uses.set(url, list);
  };
  const scanText = (text: string | null | undefined, use: MediaUse) => {
    if (!text) return;
    for (const url of wanted) if (text.includes(url)) add(url, use);
  };

  const [productRows, categoryRows, postRows, testimonialRows, settingRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, images: products.images, video: products.video, description: products.description })
      .from(products),
    db.select({ id: categories.id, label: categories.label, image: categories.image, seoContent: categories.seoContent }).from(categories),
    db.select({ id: posts.id, title: posts.title, coverImage: posts.coverImage, content: posts.content }).from(posts),
    db.select({ id: testimonials.id, name: testimonials.name, image: testimonials.image }).from(testimonials),
    db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings),
  ]);

  for (const p of productRows) {
    const use: MediaUse = { kind: "product", label: p.name, href: `/dashboard/products/update/${p.id}` };
    for (const image of p.images) add(image, use);
    if (p.video) add(p.video, use);
    scanText(p.description, use);
  }
  for (const c of categoryRows) {
    const use: MediaUse = { kind: "category", label: c.label, href: "/dashboard/categories" };
    if (c.image) add(c.image, use);
    scanText(c.seoContent, use);
  }
  for (const p of postRows) {
    const use: MediaUse = { kind: "post", label: p.title, href: `/dashboard/blog/update/${p.id}` };
    if (p.coverImage) add(p.coverImage, use);
    scanText(p.content, use);
  }
  for (const t of testimonialRows) {
    if (t.image) add(t.image, { kind: "testimonial", label: t.name, href: "/dashboard/testimonials" });
  }
  // Secrets are sealed and never hold a media URL, so scanning them is harmless.
  for (const s of settingRows) {
    scanText(s.value, { kind: "setting", label: s.key, href: settingsPageFor(s.key) });
  }
  return uses;
}

/** The page that edits a setting: SEO image, the product ad, else Website (logo, hero, banners). */
function settingsPageFor(key: string): string {
  if (key.startsWith("seo_")) return "/dashboard/settings/seo";
  if (key.startsWith("product_ad")) return "/dashboard/promotions";
  return "/dashboard/settings/website";
}
