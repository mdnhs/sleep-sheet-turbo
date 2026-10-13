// Shared by the media library API (features/media/server) and its page.

/** Folders new uploads may go to. "library" is for files added from the Media page. */
export const MEDIA_UPLOAD_FOLDERS = ["library", "products", "categories", "blog", "testimonials", "promotions"] as const;
export type MediaUploadFolder = (typeof MEDIA_UPLOAD_FOLDERS)[number];

export type MediaUse = { kind: "product" | "category" | "post" | "testimonial" | "setting"; label: string; href: string };

export type MediaItem = {
  key: string;
  url: string;
  folder: string;
  name: string;
  kind: "image" | "video" | "other";
  size: number;
  lastModified: string;
  usedBy: MediaUse[];
};
