"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type PromoBanner = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  linkText: string;
  link: string;
};

const DEFAULT_BANNERS: PromoBanner[] = [
  {
    id: "top-banner",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop",
    subtitle: "Best Seller",
    title: "All-Season Comforters",
    linkText: "View Collection",
    link: "/shop?category=Comforters",
  },
  {
    id: "bottom-banner",
    image: "https://images.unsplash.com/photo-1616627547584-bf28cee262db?q=80&w=800&auto=format&fit=crop",
    subtitle: "New Arrivals",
    title: "Luxury Hotel Bedsheets",
    linkText: "Shop Now",
    link: "/shop?category=Bedsheets",
  },
];

export function PromoBannersManager() {
  const form = useFormContext();
  const [banners, setBanners] = useState<PromoBanner[]>(DEFAULT_BANNERS);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  useEffect(() => {
    const raw = form.getValues("promo_banners");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating local banner state from the form's stored value once, on mount.
          setBanners(parsed);
        }
      } catch (e) {
        console.error("Failed to parse promo banners", e);
      }
    }
  }, [form, form.watch("promo_banners")]);

  const updateBanners = (newBanners: PromoBanner[]) => {
    setBanners(newBanners);
    form.setValue("promo_banners", JSON.stringify(newBanners), { shouldDirty: true });
  };

  const updateBannerField = (id: string, field: keyof PromoBanner, value: string) => {
    updateBanners(banners.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadId) return;

    setIsUploading((prev) => ({ ...prev, [activeUploadId]: true }));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/testimonials/upload-image", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      
      updateBannerField(activeUploadId, "image", json.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading((prev) => ({ ...prev, [activeUploadId]: false }));
      setActiveUploadId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (id: string) => {
    setActiveUploadId(id);
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotional Side Banners</CardTitle>
        <CardDescription>Manage the two promotional banners displayed next to the hero carousel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageSelect}
        />
        
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div key={banner.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-xl relative bg-card shadow-sm group">
              {/* Image Upload/Preview */}
              <div className="w-full md:w-48 h-32 md:h-48 shrink-0 relative bg-muted rounded-lg overflow-hidden border">
                {banner.image ? (
                  <>
                    <Image src={banner.image} alt="Banner preview" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => triggerUpload(banner.id)}
                        disabled={isUploading[banner.id]}
                      >
                        {isUploading[banner.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Image"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerUpload(banner.id)}
                    disabled={isUploading[banner.id]}
                    className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    {isUploading[banner.id] ? (
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    ) : (
                      <ImagePlus className="h-6 w-6 mb-2" />
                    )}
                    <span className="text-xs font-medium">Upload Image</span>
                  </button>
                )}
              </div>

              {/* Form Fields */}
              <div className="flex-1 space-y-4">
                <h4 className="font-semibold text-sm">Banner {index + 1} ({index === 0 ? "Top" : "Bottom"})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Subtitle (Small text)</FormLabel>
                    <Input
                      value={banner.subtitle}
                      onChange={(e) => updateBannerField(banner.id, "subtitle", e.target.value)}
                      placeholder="Best Seller"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Main Title</FormLabel>
                    <Input
                      value={banner.title}
                      onChange={(e) => updateBannerField(banner.id, "title", e.target.value)}
                      placeholder="All-Season Comforters"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Link Text</FormLabel>
                    <Input
                      value={banner.linkText}
                      onChange={(e) => updateBannerField(banner.id, "linkText", e.target.value)}
                      placeholder="View Collection"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>CTA Link</FormLabel>
                    <Input
                      value={banner.link}
                      onChange={(e) => updateBannerField(banner.id, "link", e.target.value)}
                      placeholder="/shop?category=Comforters"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
